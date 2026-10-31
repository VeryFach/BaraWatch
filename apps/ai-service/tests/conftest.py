import pytest

from fastapi.testclient import TestClient

from app.main import app
from app.core.config import Settings, get_settings

TEST_INTERNAL_KEY = "a" * 40

@pytest.fixture
def client():

    def override_settings():
        return Settings(
            _env_file=None,
            app_env="test",
            ai_internal_key=TEST_INTERNAL_KEY,
            vision_api_key="v" * 32,
        )

    app.dependency_overrides[get_settings] = override_settings

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()