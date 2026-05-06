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
    frontend_url: str = Field(default="http://localhost:5173")
    environment: Literal["development", "production", "test"] = Field(default="development")


@lru_cache
def get_settings() -> Settings:
    return Settings()
