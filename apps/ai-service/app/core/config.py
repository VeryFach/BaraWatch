from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    app_name: str = "BaraWatch AI"
    app_version: str = "0.2.0"

    app_env: Literal[
        "development", "test", "staging", "production"
    ] = "development"

    log_level: Literal[
        "DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"
    ] = "INFO"

    ai_internal_key: str = Field(default="", repr=False)
    firms_map_key: str = Field(default="", repr=False)
    vision_api_key: str = Field(
        default="",
        validation_alias="BARAWATCH_AI_API_KEY",
        repr=False,
    )

    @model_validator(mode="after")
    def validate_security(self):
        if self.app_env in ("staging", "production"):
            if len(self.ai_internal_key) < 32:
                raise ValueError(
                    "AI_INTERNAL_KEY minimal 32 karakter"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()