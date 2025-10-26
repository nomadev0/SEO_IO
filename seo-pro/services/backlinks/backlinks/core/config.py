from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration driven by environment variables."""

    model_config = SettingsConfigDict(env_prefix="BACKLINKS_", env_file=".env")

    environment: Literal["local", "development", "production"] = "local"
    log_level: str = "INFO"
    database_url: str = Field(
        "postgresql+asyncpg://postgres:postgres@db:5432/backlinks",
        alias="DATABASE_URL",
    )
    sync_database_url: str = Field(
        "postgresql+psycopg://postgres:postgres@db:5432/backlinks",
        alias="SYNC_DATABASE_URL",
    )
    redis_url: str = Field("redis://redis:6379/0", alias="REDIS_URL")
    auth_dev_token: str = Field("devtoken-backlinks", alias="AUTH_DEV_TOKEN")
    pagination_size: int = Field(50, alias="PAGINATION_SIZE")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()

