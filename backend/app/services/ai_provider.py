import asyncio
import datetime
import hashlib
import json
import logging
import re
import time
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("ai_resilience")
logger.setLevel(logging.INFO)

# ==========================================
# 1. ERROR CLASSIFICATION SYSTEM
# ==========================================

class AIErrorCategory(str, Enum):
    BAD_REQUEST = "bad_request"         # 400 - invalid payload/structure (non-retryable)
    UNAUTHORIZED = "unauthorized"       # 401 - invalid API key (non-retryable)
    FORBIDDEN = "forbidden"             # 403 - permission denied (non-retryable)
    NOT_FOUND = "not_found"             # 404 - model/endpoint not found (non-retryable)
    RATE_LIMIT = "rate_limit"           # 429 - rate limit / quota exhausted (retryable)
    SERVER_ERROR = "server_error"       # 500/502/503/504 - upstream server error (retryable)
    TIMEOUT = "timeout"                 # Request timeout (retryable)
    NETWORK_ERROR = "network_error"     # Transport/DNS failure (retryable)
    UNKNOWN = "unknown"                 # General unhandled error (retryable once)

def classify_ai_error(status_code: Optional[int] = None, exception: Optional[Exception] = None) -> Tuple[AIErrorCategory, bool]:
    """
    Classifies errors into category and returns (category, is_retryable).
    """
    if exception is not None:
        if isinstance(exception, (httpx.TimeoutException, asyncio.TimeoutError)):
            return AIErrorCategory.TIMEOUT, True
        if isinstance(exception, (httpx.NetworkError, httpx.ConnectError, httpx.ConnectTimeout)):
            return AIErrorCategory.NETWORK_ERROR, True

    if status_code is not None:
        if status_code == 400:
            return AIErrorCategory.BAD_REQUEST, False
        elif status_code == 401:
            return AIErrorCategory.UNAUTHORIZED, False
        elif status_code == 403:
            return AIErrorCategory.FORBIDDEN, False
        elif status_code == 404:
            return AIErrorCategory.NOT_FOUND, False
        elif status_code == 429:
            return AIErrorCategory.RATE_LIMIT, True
        elif status_code in (500, 502, 503, 504):
            return AIErrorCategory.SERVER_ERROR, True

    return AIErrorCategory.UNKNOWN, True


def mask_secrets(text: str) -> str:
    """
    Sanitizes log messages to ensure API keys and credentials are never exposed.
    """
    if not text:
        return ""
    sanitized = str(text)
    if settings.GEMINI_API_KEY and len(settings.GEMINI_API_KEY) > 6:
        sanitized = sanitized.replace(settings.GEMINI_API_KEY, "[GEMINI_API_KEY_HIDDEN]")
    if settings.FALLBACK_API_KEY and len(settings.FALLBACK_API_KEY) > 6:
        sanitized = sanitized.replace(settings.FALLBACK_API_KEY, "[FALLBACK_API_KEY_HIDDEN]")
    # Mask Authorization Headers / Bearer tokens
    sanitized = re.sub(r'Bearer\s+[A-Za-z0-9\-\_\.\~\+\/]+=*', 'Bearer [TOKEN_HIDDEN]', sanitized, flags=re.IGNORECASE)
    sanitized = re.sub(r'key=[A-Za-z0-9\-\_\.]+', 'key=[KEY_HIDDEN]', sanitized, flags=re.IGNORECASE)
    return sanitized


class AIProviderError(Exception):
    def __init__(self, message: str, provider: str, status_code: Optional[int], category: AIErrorCategory, is_retryable: bool):
        super().__init__(mask_secrets(message))
        self.message = mask_secrets(message)
        self.provider = provider
        self.status_code = status_code
        self.category = category
        self.is_retryable = is_retryable


# ==========================================
# 2. PROVIDER HEALTH / CIRCUIT BREAKER
# ==========================================

class ProviderHealthTracker:
    def __init__(self, cooldown_seconds: float = 30.0):
        self.cooldown_seconds = cooldown_seconds
        self._consecutive_failures: Dict[str, int] = {}
        self._cooldown_until: Dict[str, float] = {}

    def is_healthy(self, provider_name: str) -> bool:
        now = time.time()
        cooldown_end = self._cooldown_until.get(provider_name, 0.0)
        if now < cooldown_end:
            return False
        return True

    def record_success(self, provider_name: str):
        self._consecutive_failures[provider_name] = 0
        self._cooldown_until[provider_name] = 0.0

    def record_failure(self, provider_name: str, is_retryable: bool):
        failures = self._consecutive_failures.get(provider_name, 0) + 1
        self._consecutive_failures[provider_name] = failures
        # Trigger cooldown if 3 consecutive retryable failures occur
        if failures >= 3 and is_retryable:
            self._cooldown_until[provider_name] = time.time() + self.cooldown_seconds
            print(mask_secrets(f"[CIRCUIT BREAKER] Provider '{provider_name}' marked UNHEALTHY (cooldown {self.cooldown_seconds}s after {failures} failures)"))

    def get_status(self) -> Dict[str, Any]:
        now = time.time()
        res = {}
        for p in ["gemini", "fallback"]:
            cooldown_end = self._cooldown_until.get(p, 0.0)
            in_cooldown = now < cooldown_end
            res[p] = {
                "healthy": not in_cooldown,
                "consecutive_failures": self._consecutive_failures.get(p, 0),
                "cooldown_remaining_seconds": max(0.0, round(cooldown_end - now, 1)) if in_cooldown else 0.0
            }
        return res

global_health_tracker = ProviderHealthTracker(cooldown_seconds=settings.AI_PROVIDER_COOLDOWN_SECONDS)


# ==========================================
# 3. REQUEST DEDUPLICATION & SAFE CACHE
# ==========================================

class RequestDeduplicator:
    def __init__(self):
        self._in_flight: Dict[str, asyncio.Future] = {}

    async def execute_or_wait(self, dedup_key: str, coroutine_fn):
        if not dedup_key:
            return await coroutine_fn()

        if dedup_key in self._in_flight:
            print(f"[DEDUPLICATION] Reusing in-flight request for key: {dedup_key[:16]}...")
            return await self._in_flight[dedup_key]

        loop = asyncio.get_running_loop()
        future = loop.create_future()
        self._in_flight[dedup_key] = future

        try:
            result = await coroutine_fn()
            future.set_result(result)
            return result
        except Exception as exc:
            future.set_exception(exc)
            raise
        finally:
            self._in_flight.pop(dedup_key, None)

global_deduplicator = RequestDeduplicator()


class SafeAICache:
    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self._store: Dict[str, Tuple[float, str]] = {}

    def get(self, cache_key: str) -> Optional[str]:
        if not settings.AI_CACHE_ENABLED or not cache_key:
            return None
        entry = self._store.get(cache_key)
        if not entry:
            return None
        timestamp, response_text = entry
        if time.time() - timestamp > self.ttl_seconds:
            self._store.pop(cache_key, None)
            return None
        return response_text

    def set(self, cache_key: str, response_text: str):
        if not settings.AI_CACHE_ENABLED or not cache_key or not response_text:
            return
        self._store[cache_key] = (time.time(), response_text)

global_ai_cache = SafeAICache(ttl_seconds=settings.AI_CACHE_TTL_SECONDS)


# ==========================================
# 4. PROVIDER IMPLEMENTATIONS
# ==========================================

class BaseAIProvider:
    def __init__(self, name: str):
        self.name = name

    async def generate_response(
        self,
        prompt: str,
        payload: Dict[str, Any],
        timeout: float
    ) -> Dict[str, Any]:
        raise NotImplementedError


class GeminiProvider(BaseAIProvider):
    def __init__(self):
        super().__init__("gemini")

    def _normalize_model(self, raw_model: str) -> str:
        model = (raw_model or "gemini-flash-latest").strip().strip("'\"")
        if model.startswith("models/"):
            model = model[7:]
        return model

    async def generate_response(
        self,
        prompt: str,
        payload: Dict[str, Any],
        timeout: float
    ) -> Dict[str, Any]:
        api_key = settings.GEMINI_API_KEY
        if not api_key or api_key == "YOUR_GEMINI_API_KEY_HERE":
            raise AIProviderError(
                message="Gemini API Key is not configured in backend settings.",
                provider=self.name,
                status_code=401,
                category=AIErrorCategory.UNAUTHORIZED,
                is_retryable=False
            )

        clean_model = self._normalize_model(settings.GEMINI_MODEL)
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{clean_model}:generateContent?key={api_key}"

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(url, json=payload)
            
            latency = time.time() - start_time
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return {
                    "text": text,
                    "provider": self.name,
                    "model": clean_model,
                    "latency": round(latency, 2),
                    "raw_response": data
                }

            # Error handling
            category, is_retryable = classify_ai_error(status_code=res.status_code)
            body_snippet = mask_secrets(res.text[:300])
            err_msg = f"Gemini API returned HTTP {res.status_code} ({category.value}): {body_snippet}"
            raise AIProviderError(
                message=err_msg,
                provider=self.name,
                status_code=res.status_code,
                category=category,
                is_retryable=is_retryable
            )

        except httpx.TimeoutException as exc:
            category, is_retryable = classify_ai_error(exception=exc)
            raise AIProviderError(
                message=f"Gemini API request timed out after {timeout}s",
                provider=self.name,
                status_code=None,
                category=category,
                is_retryable=is_retryable
            ) from exc

        except httpx.NetworkError as exc:
            category, is_retryable = classify_ai_error(exception=exc)
            raise AIProviderError(
                message=f"Gemini network transport failure: {str(exc)}",
                provider=self.name,
                status_code=None,
                category=category,
                is_retryable=is_retryable
            ) from exc

        except AIProviderError:
            raise

        except Exception as exc:
            category, is_retryable = classify_ai_error(exception=exc)
            raise AIProviderError(
                message=f"Gemini unexpected error: {str(exc)}",
                provider=self.name,
                status_code=None,
                category=category,
                is_retryable=is_retryable
            ) from exc


class OpenAICompatibleFallbackProvider(BaseAIProvider):
    """
    Fallback provider supporting OpenAI, OpenRouter, Groq, or any OpenAI-compatible API.
    """
    def __init__(self):
        super().__init__("fallback")

    def _convert_gemini_payload_to_openai_messages(self, payload: Dict[str, Any]) -> List[Dict[str, str]]:
        messages = []

        # Extract systemInstruction if present
        sys_inst = payload.get("systemInstruction", {})
        sys_parts = sys_inst.get("parts", [])
        if sys_parts and sys_parts[0].get("text"):
            messages.append({"role": "system", "content": sys_parts[0]["text"]})

        # Extract contents
        contents = payload.get("contents", [])
        for turn in contents:
            role = "user" if turn.get("role") == "user" else "assistant"
            parts = turn.get("parts", [])
            text_acc = []
            for p in parts:
                if "text" in p and p["text"]:
                    text_acc.append(p["text"])
            if text_acc:
                messages.append({"role": role, "content": "\n".join(text_acc)})

        return messages

    async def generate_response(
        self,
        prompt: str,
        payload: Dict[str, Any],
        timeout: float
    ) -> Dict[str, Any]:
        api_key = settings.FALLBACK_API_KEY
        if not api_key or not settings.AI_FALLBACK_PROVIDER:
            raise AIProviderError(
                message="Fallback AI provider is not configured or missing FALLBACK_API_KEY.",
                provider=self.name,
                status_code=401,
                category=AIErrorCategory.UNAUTHORIZED,
                is_retryable=False
            )

        base_url = settings.FALLBACK_API_BASE_URL.rstrip("/")
        url = f"{base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        openai_messages = self._convert_gemini_payload_to_openai_messages(payload)
        fallback_payload = {
            "model": settings.FALLBACK_MODEL,
            "messages": openai_messages,
            "temperature": 0.7
        }

        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                res = await client.post(url, json=fallback_payload, headers=headers)

            latency = time.time() - start_time
            if res.status_code == 200:
                data = res.json()
                text = data["choices"][0]["message"]["content"]
                return {
                    "text": text,
                    "provider": f"fallback ({settings.AI_FALLBACK_PROVIDER})",
                    "model": settings.FALLBACK_MODEL,
                    "latency": round(latency, 2),
                    "raw_response": data
                }

            category, is_retryable = classify_ai_error(status_code=res.status_code)
            body_snippet = mask_secrets(res.text[:300])
            err_msg = f"Fallback API returned HTTP {res.status_code} ({category.value}): {body_snippet}"
            raise AIProviderError(
                message=err_msg,
                provider=self.name,
                status_code=res.status_code,
                category=category,
                is_retryable=is_retryable
            )

        except httpx.TimeoutException as exc:
            category, is_retryable = classify_ai_error(exception=exc)
            raise AIProviderError(
                message=f"Fallback API request timed out after {timeout}s",
                provider=self.name,
                status_code=None,
                category=category,
                is_retryable=is_retryable
            ) from exc

        except AIProviderError:
            raise

        except Exception as exc:
            category, is_retryable = classify_ai_error(exception=exc)
            raise AIProviderError(
                message=f"Fallback API unexpected error: {str(exc)}",
                provider=self.name,
                status_code=None,
                category=category,
                is_retryable=is_retryable
            ) from exc


# ==========================================
# 5. CENTRALIZED AI ORCHESTRATOR
# ==========================================

class AIOrchestrator:
    def __init__(self):
        self.primary_provider = GeminiProvider()
        self.fallback_provider = OpenAICompatibleFallbackProvider()

    def _generate_cache_key(self, user_id: str, prompt: str, is_personalized: bool) -> Optional[str]:
        if is_personalized or not prompt:
            return None
        raw = f"{prompt.strip().lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def generate_with_resilience(
        self,
        req_id: str,
        user_id: str,
        prompt: str,
        payload: Dict[str, Any],
        is_personalized: bool = True
    ) -> Dict[str, Any]:
        """
        Orchestrates AI generation with deduplication, caching, retries, circuit breaker, and provider failover.
        """
        # 1. Deduplication
        dedup_key = f"{user_id}:{hashlib.md5(prompt.encode('utf-8')).hexdigest()}" if prompt else ""
        
        async def _execute_pipeline():
            # 2. Check Cache for general questions
            cache_key = self._generate_cache_key(user_id, prompt, is_personalized)
            if cache_key:
                cached_resp = global_ai_cache.get(cache_key)
                if cached_resp:
                    print(mask_secrets(f"[AI RESULT] Req ID: {req_id} | Provider: cache | Status: success (cached)"))
                    return {
                        "text": cached_resp,
                        "provider": "cache",
                        "model": settings.GEMINI_MODEL,
                        "latency": 0.01,
                        "cached": True
                    }

            max_retries = max(0, min(5, settings.AI_MAX_RETRIES))
            timeout = settings.AI_REQUEST_TIMEOUT_SECONDS

            # Determine whether primary provider is healthy
            primary_name = "gemini"
            use_primary = global_health_tracker.is_healthy(primary_name)

            if not use_primary:
                print(mask_secrets(f"[AI REQUEST] Req ID: {req_id} | Primary 'gemini' in COOLDOWN -> Attempting Fallback directly."))

            last_error: Optional[AIProviderError] = None

            # --- ATTEMPT 1: Primary Gemini Provider ---
            if use_primary:
                for attempt in range(1, max_retries + 2):
                    print(mask_secrets(f"[AI REQUEST] Req ID: {req_id} | Provider: {primary_name} | Model: {settings.GEMINI_MODEL} | Attempt: {attempt}"))
                    try:
                        result = await self.primary_provider.generate_response(prompt, payload, timeout=timeout)
                        global_health_tracker.record_success(primary_name)
                        print(mask_secrets(f"[AI RESULT] Req ID: {req_id} | Provider: {primary_name} | Status: success | Latency: {result['latency']}s"))

                        if cache_key and result.get("text"):
                            global_ai_cache.set(cache_key, result["text"])
                        return result

                    except AIProviderError as err:
                        last_error = err
                        global_health_tracker.record_failure(primary_name, err.is_retryable)
                        print(mask_secrets(f"[AI PROVIDER ERROR] Req ID: {req_id} | Provider: {err.provider} | Status: {err.status_code or 'N/A'} | Category: {err.category.value} | Attempt: {attempt}"))

                        if not err.is_retryable:
                            print(mask_secrets(f"[AI RETRY STOP] Non-retryable error ({err.category.value}). Aborting retries for {primary_name}."))
                            break

                        if attempt <= max_retries:
                            backoff_seconds = 0.5 * (2 ** (attempt - 1))  # 0.5s, 1.0s, 2.0s
                            print(mask_secrets(f"[AI RETRY] Req ID: {req_id} | Temporary failure ({err.category.value}). Retrying in {backoff_seconds}s..."))
                            await asyncio.sleep(backoff_seconds)
                        else:
                            print(mask_secrets(f"[AI RETRY STOP] Max retries reached for {primary_name}."))

            # --- ATTEMPT 2: Fallback Provider (If Primary Failed or in Cooldown) ---
            has_fallback_config = bool(settings.AI_FALLBACK_PROVIDER and settings.FALLBACK_API_KEY)
            if has_fallback_config:
                print(mask_secrets(f"[FALLBACK] Req ID: {req_id} | Primary: gemini failed/cooldown | Triggering Fallback provider ({settings.AI_FALLBACK_PROVIDER})."))
                fallback_name = "fallback"
                for attempt in range(1, max_retries + 2):
                    print(mask_secrets(f"[AI REQUEST] Req ID: {req_id} | Provider: {fallback_name} ({settings.AI_FALLBACK_PROVIDER}) | Model: {settings.FALLBACK_MODEL} | Attempt: {attempt}"))
                    try:
                        result = await self.fallback_provider.generate_response(prompt, payload, timeout=timeout)
                        global_health_tracker.record_success(fallback_name)
                        print(mask_secrets(f"[AI RESULT] Req ID: {req_id} | Provider: {result['provider']} | Status: success | Latency: {result['latency']}s"))

                        if cache_key and result.get("text"):
                            global_ai_cache.set(cache_key, result["text"])
                        return result

                    except AIProviderError as err:
                        global_health_tracker.record_failure(fallback_name, err.is_retryable)
                        print(mask_secrets(f"[AI PROVIDER ERROR] Req ID: {req_id} | Provider: {err.provider} | Status: {err.status_code or 'N/A'} | Category: {err.category.value} | Attempt: {attempt}"))

                        if not err.is_retryable:
                            break

                        if attempt <= max_retries:
                            backoff_seconds = 0.5 * (2 ** (attempt - 1))
                            await asyncio.sleep(backoff_seconds)

            # --- ALL PROVIDERS FAILED ---
            print(mask_secrets(f"[AI ALL PROVIDERS EXHAUSTED] Req ID: {req_id} | All response paths failed."))
            
            # Formulate safe user-facing message
            if last_error and last_error.category in (AIErrorCategory.UNAUTHORIZED, AIErrorCategory.FORBIDDEN, AIErrorCategory.NOT_FOUND):
                user_msg = "The AI service configuration is currently being updated. Please try again shortly."
            else:
                user_msg = "AI provider is temporarily unavailable. Please try again shortly."

            return {
                "text": user_msg,
                "provider": "none",
                "model": settings.GEMINI_MODEL,
                "latency": 0.0,
                "error": True,
                "error_category": last_error.category.value if last_error else "exhausted"
            }

        return await global_deduplicator.execute_or_wait(dedup_key, _execute_pipeline)


global_ai_orchestrator = AIOrchestrator()
