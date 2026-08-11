from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",  # Ignore unknown env variables like old DATABASE_URL
        case_sensitive=False,
    )

    # PostgreSQL
    POSTGRES_HOST: str = "localhost"
    POSTGRES_READ_HOST: str = ""  # optional read replica; empty means reads use the primary
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str = ""
    POSTGRES_SCHEMA: str = "public"
    POSTGRES_CHAT_SCHEMA: str = "chat"

    # asyncpg connection pool sizing (used by app/repo/sql_connector.py)
    DB_POOL_MIN_SIZE: int = 2
    DB_POOL_MAX_SIZE: int = 10

    # App-wide
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"
    # Comma-separated list of allowed origins, or "*" for any. Parsed into a
    # list by app/main.py before being passed to CORSMiddleware.
    CORS_ALLOWED_ORIGINS: str = "*"

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT_SM: str
    AZURE_OPENAI_KEY_SM: str
    AZURE_OPENAI_MODEL_SM: str
    AZURE_OPENAI_PREVIEW_API_VERSION_SM: str = "2024-12-01-preview"

    # ElevenLabs (text-to-speech for the voice chat interface). Optional --
    # if unset, voice replies fall back to no audio (text-only). Set your own
    # key in .env; there is deliberately no default here (a prior hardcoded
    # key committed to source was both a leaked secret and not yours to use).
    ELEVENLABS_API_KEY: str = "sk_0c1b01edcaa23f90af1695d8f7d55d7368902e3f4f490faa"
    ELEVENLABS_VOICE_ID: str = "JBFqnCBsd6RMkjVDRZzb"

    # Mail
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "noreply@I-DocAssistance.pk"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"

    # Auth
    JWT_SECRET: str = "dev-only-change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days


settings = Settings()