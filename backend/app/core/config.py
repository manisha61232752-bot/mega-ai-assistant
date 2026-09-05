import os
import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Mega Assistant API"
    API_V1_STR: str = "/api"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-flash-latest"
    MONGODB_URI: str = ""
    
    # AI Provider & Resilience Configurations
    AI_PRIMARY_PROVIDER: str = "gemini"
    AI_FALLBACK_PROVIDER: str = ""  # e.g. "openai", "openrouter", "groq"
    FALLBACK_API_KEY: str = ""
    FALLBACK_MODEL: str = "openai/gpt-oss-20b"
    FALLBACK_API_BASE_URL: str = "https://api.openai.com/v1"
    
    AI_MAX_RETRIES: int = 2
    AI_REQUEST_TIMEOUT_SECONDS: float = 30.0
    AI_PROVIDER_COOLDOWN_SECONDS: float = 30.0
    AI_CACHE_ENABLED: bool = True
    AI_CACHE_TTL_SECONDS: int = 300
    
    # CORS Origins - parsed as list from environment variable JSON or comma-separated string
    BACKEND_CORS_ORIGINS: List[str] = [
        "https://mega-ai-assistant.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, str) and v.startswith("["):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                pass
        return v

    model_config = SettingsConfigDict(
        env_file=(
            os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
            ".env"
        ),
        env_ignore_empty=True,
        extra="ignore"
    )

settings = Settings()
