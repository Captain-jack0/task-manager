from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_JWT_SECRET = "dev-secret-change-me"
_DEFAULT_ENCRYPTION_KEY = "dev-encryption-key-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://taskmanager:taskmanager@localhost:5432/taskmanager"
    )
    jwt_secret: str = Field(default=_DEFAULT_JWT_SECRET)
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60)
    # Any string — a proper Fernet key is derived from it. Used to encrypt
    # third-party secrets (e.g. GitHub tokens) at rest. Set a stable value in
    # production; changing it makes previously-encrypted secrets unreadable.
    app_encryption_key: str = Field(default=_DEFAULT_ENCRYPTION_KEY)
    frontend_url: str = Field(default="http://localhost:5173")
    # Public frontend URL embedded as task links in the iCal feed. Falls back to
    # the first CORS origin when unset (cors_origins is an allow-list, not
    # order-guaranteed, so prefer setting this explicitly in production).
    app_public_url: str = Field(default="")
    environment: Literal["development", "production", "test"] = Field(default="development")

    @model_validator(mode="after")
    def _guard_production_secrets(self) -> "Settings":
        """Refuse to boot in production with the public placeholder secrets — a
        default JWT secret means anyone can forge a token for any user."""
        if self.environment == "production":
            if self.jwt_secret == _DEFAULT_JWT_SECRET:
                raise ValueError("JWT_SECRET must be set (not the default) in production")
            if self.app_encryption_key == _DEFAULT_ENCRYPTION_KEY:
                raise ValueError("APP_ENCRYPTION_KEY must be set (not the default) in production")
        return self

    @property
    def cors_origins(self) -> list[str]:
        """Comma-separated FRONTEND_URL → list of allowed origins.

        Lets you set FRONTEND_URL=https://app.vercel.app,https://app-preview.vercel.app
        on Render to support preview deployments.
        """
        return [o.strip().rstrip("/") for o in self.frontend_url.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
