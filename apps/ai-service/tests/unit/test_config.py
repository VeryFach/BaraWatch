import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_default_settings():
    settings = Settings(_env_file=None, app_env="development", ai_internal_key="")
    assert settings.app_version == "0.2.0"


def test_production_requires_key():
    with pytest.raises(ValidationError):
        Settings(_env_file=None, app_env="production", ai_internal_key="short")


def test_production_accepts_strong_key():
    settings = Settings(_env_file=None, app_env="production", ai_internal_key="x" * 32)
    assert settings.app_env == "production"