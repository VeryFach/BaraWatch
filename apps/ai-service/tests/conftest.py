import pytest

from app.core.config import Settings, get_settings
from app.main import app


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None,
        app_env="test",
        ai_internal_key="a" * 40,
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()