from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://taskmanager:taskmanager@localhost:5432/taskmanager"
    )
    jwt_secret: str = Field(default="dev-secret-change-me")
    jwt_algorithm: str = Field(default="HS256")
    jwt_expire_minutes: int = Field(default=60)
    # Any string — a proper Fernet key is derived from it. Used to encrypt
    # third-party secrets (e.g. GitHub tokens) at rest. Set a stable value in
    # production; changing it makes previously-encrypted secrets unreadable.
    app_encryption_key: str = Field(default="dev-encryption-key-change-me")
    frontend_url: str = Field(default="http://localhost:5173")
    environment: Literal["development", "production", "test"] = Field(default="development")

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
