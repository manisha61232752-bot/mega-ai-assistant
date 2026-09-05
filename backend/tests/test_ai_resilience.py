import asyncio
import os
import sys
import time

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.services.ai_provider import (
    AIErrorCategory,
    AIProviderError,
    ProviderHealthTracker,
    RequestDeduplicator,
    SafeAICache,
    classify_ai_error,
    mask_secrets,
    global_ai_orchestrator
)

def test_secret_masking():
    settings.GEMINI_API_KEY = "AIzaSyTESTSECRETKEY123456789"
    settings.FALLBACK_API_KEY = "sk-proj-FALLBACKSECRETKEY987654321"

    raw_text = (
        "Error calling Gemini with key AIzaSyTESTSECRETKEY123456789. "
        "Fallback key: sk-proj-FALLBACKSECRETKEY987654321. "
        "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.Secret"
    )

    sanitized = mask_secrets(raw_text)

    assert "AIzaSyTESTSECRETKEY123456789" not in sanitized
    assert "sk-proj-FALLBACKSECRETKEY987654321" not in sanitized
    assert "[GEMINI_API_KEY_HIDDEN]" in sanitized
    assert "[FALLBACK_API_KEY_HIDDEN]" in sanitized
    assert "[TOKEN_HIDDEN]" in sanitized
    print("[PASSED] Secret Masking Test")


def test_error_classification():
    cat, retryable = classify_ai_error(status_code=400)
    assert cat == AIErrorCategory.BAD_REQUEST and not retryable

    cat, retryable = classify_ai_error(status_code=401)
    assert cat == AIErrorCategory.UNAUTHORIZED and not retryable

    cat, retryable = classify_ai_error(status_code=403)
    assert cat == AIErrorCategory.FORBIDDEN and not retryable

    cat, retryable = classify_ai_error(status_code=404)
    assert cat == AIErrorCategory.NOT_FOUND and not retryable

    cat, retryable = classify_ai_error(status_code=429)
    assert cat == AIErrorCategory.RATE_LIMIT and retryable

    cat, retryable = classify_ai_error(status_code=500)
    assert cat == AIErrorCategory.SERVER_ERROR and retryable

    cat, retryable = classify_ai_error(status_code=503)
    assert cat == AIErrorCategory.SERVER_ERROR and retryable

    cat, retryable = classify_ai_error(exception=asyncio.TimeoutError())
    assert cat == AIErrorCategory.TIMEOUT and retryable

    print("[PASSED] Error Classification Test")


def test_circuit_breaker():
    tracker = ProviderHealthTracker(cooldown_seconds=1.0)
    provider_name = "test_provider"

    assert tracker.is_healthy(provider_name) is True

    # Record 2 failures -> still healthy
    tracker.record_failure(provider_name, is_retryable=True)
    tracker.record_failure(provider_name, is_retryable=True)
    assert tracker.is_healthy(provider_name) is True

    # 3rd failure -> enters cooldown (unhealthy)
    tracker.record_failure(provider_name, is_retryable=True)
    assert tracker.is_healthy(provider_name) is False

    status = tracker.get_status()
    assert provider_name in status or "gemini" in status

    # Wait for cooldown to expire
    time.sleep(1.1)
    assert tracker.is_healthy(provider_name) is True
    print("[PASSED] Circuit Breaker Test")


def test_cache_ttl():
    cache = SafeAICache(ttl_seconds=1)
    key = "test_query_key"
    cache.set(key, "Response Content")

    assert cache.get(key) == "Response Content"

    time.sleep(1.1)
    assert cache.get(key) is None
    print("[PASSED] Safe Cache TTL Test")


async def test_deduplication():
    dedup = RequestDeduplicator()
    counter = 0

    async def slow_work():
        nonlocal counter
        counter += 1
        await asyncio.sleep(0.1)
        return f"result-{counter}"

    res1, res2 = await asyncio.gather(
        dedup.execute_or_wait("same_key", slow_work),
        dedup.execute_or_wait("same_key", slow_work)
    )

    assert res1 == res2 == "result-1"
    assert counter == 1
    print("[PASSED] Request Deduplication Test")


async def test_ai_orchestrator_mock_failover():
    # Setup mock configuration for fallback test
    settings.AI_PRIMARY_PROVIDER = "gemini"
    settings.AI_FALLBACK_PROVIDER = "openai"
    settings.FALLBACK_API_KEY = "mock_fallback_key"
    settings.AI_MAX_RETRIES = 1

    payload = {"contents": [{"parts": [{"text": "Hello world"}]}]}

    # Execute orchestrator with invalid primary key -> Should failover safely without crashing
    res = await global_ai_orchestrator.generate_with_resilience(
        req_id="test_req_001",
        user_id="test_user",
        prompt="Hello world",
        payload=payload,
        is_personalized=False
    )

    assert "text" in res
    assert "provider" in res
    print(f"[PASSED] AI Orchestrator Integration Test (Returned provider: {res['provider']})")


def test_url_normalization():
    from app.services.ai_provider import OpenAICompatibleFallbackProvider

    provider = OpenAICompatibleFallbackProvider()

    # 1. Base URL without suffix for OpenAI
    url = provider._resolve_request_url("https://api.openai.com/v1", "openai")
    assert url == "https://api.openai.com/v1/chat/completions"
    assert url.count("/chat/completions") == 1

    # 2. Base URL with /chat/completions suffix for OpenAI
    url = provider._resolve_request_url("https://api.openai.com/v1/chat/completions", "openai")
    assert url == "https://api.openai.com/v1/chat/completions"
    assert url.count("/chat/completions") == 1

    # 3. Groq base URL normalization test cases (both HTTP and HTTPS)
    groq_cases = [
        "http://api.groq.com",
        "https://api.groq.com",
        "http://api.groq.com/v1",
        "https://api.groq.com/v1",
        "http://api.groq.com/openai/v1",
        "https://api.groq.com/openai/v1",
        "http://api.groq.com/openai/v1/chat/completions",
        "https://api.groq.com/openai/v1/chat/completions",
        "https://api.openai.com/v1",  # OpenAI default fallback with groq provider
        "",  # Empty base URL
    ]

    for case in groq_cases:
        resolved_url = provider._resolve_request_url(case, "groq")
        assert resolved_url == "https://api.groq.com/openai/v1/chat/completions", f"Failed for case: {case}"
        assert resolved_url.count("/chat/completions") == 1

    print("[PASSED] URL Normalization Test")


async def test_safe_error_payload():
    # Verify that when providers fail, no secrets or raw exception tracebacks leak to client
    settings.AI_PRIMARY_PROVIDER = "gemini"
    settings.GEMINI_API_KEY = "invalid_gemini_key_secret_123"
    settings.AI_FALLBACK_PROVIDER = "groq"
    settings.FALLBACK_API_KEY = "gsk_invalid_groq_key_secret_456"
    settings.AI_MAX_RETRIES = 0

    res = await global_ai_orchestrator.generate_with_resilience(
        req_id="test_safe_err_001",
        user_id="test_user_safe",
        prompt="Test prompt for safe error",
        payload={"contents": [{"parts": [{"text": "Test"}]}]},
        is_personalized=False
    )

    assert res.get("error") is True
    assert res.get("provider") == "none"
    assert "text" in res
    assert "invalid_gemini_key_secret_123" not in res["text"]
    assert "gsk_invalid_groq_key_secret_456" not in res["text"]
    assert "Traceback" not in res["text"]
    print("[PASSED] Safe Error Payload Test")


if __name__ == "__main__":
    test_secret_masking()
    test_error_classification()
    test_circuit_breaker()
    test_cache_ttl()
    test_url_normalization()
    asyncio.run(test_deduplication())
    asyncio.run(test_ai_orchestrator_mock_failover())
    asyncio.run(test_safe_error_payload())
    print("\nALL AI RESILIENCE TESTS PASSED 100%!")
