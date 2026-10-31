from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app


def test_fetch_parse_rejects_missing_key(monkeypatch):
    from app.api.v1 import firms

    monkeypatch.setattr(
        firms,
        "get_settings",
        lambda: Settings(
            _env_file=None, app_env="test", ai_internal_key="", firms_map_key="secret"
        ),
    )
    response = TestClient(app).post(
        "/v1/firms/fetch-parse",
        json={"source": "VIIRS_SNPP_NRT", "bbox": [100, -5, 101, -4]},
    )
    assert response.status_code == 503
    assert "secret" not in response.text


def test_fetch_parse_requires_auth(monkeypatch):
    from app.api.v1 import firms

    monkeypatch.setattr(
        firms,
        "get_settings",
        lambda: Settings(
            _env_file=None,
            app_env="test",
            ai_internal_key="k" * 40,
            firms_map_key="secret",
        ),
    )
    response = TestClient(app).post(
        "/v1/firms/fetch-parse",
        json={"source": "VIIRS_SNPP_NRT", "bbox": [100, -5, 101, -4]},
    )
    assert response.status_code == 401


def test_fetch_parse_validates_source_bbox_and_days():
    client = TestClient(app)
    base = {"source": "VIIRS_SNPP_NRT", "bbox": [100, -5, 101, -4], "days": 1}
    for changes in (
        {"source": "unsupported"},
        {"bbox": [101, -5, 100, -4]},
        {"days": 6},
    ):
        response = client.post("/v1/firms/fetch-parse", json={**base, **changes})
        assert response.status_code == 422


def test_fetch_parse_returns_existing_parser_fields_without_secret(monkeypatch):
    from app.api.v1 import firms

    key = "do-not-return-this-map-key"
    monkeypatch.setattr(
        firms,
        "get_settings",
        lambda: Settings(
            _env_file=None, app_env="test", ai_internal_key="k" * 40, firms_map_key=key
        ),
    )
    observed = {}

    def fake_download(map_key, source, bbox, days):
        observed.update(map_key=map_key, source=source, bbox=bbox, days=days)
        return (
            "latitude,longitude,acq_date,acq_time,satellite,instrument,confidence,frp\n"
            "-2.2,113.9,2026-10-30,0300,N20,VIIRS,h,12.0\n"
        )

    monkeypatch.setattr(firms, "download_firms_csv", fake_download)
    response = TestClient(app).post(
        "/v1/firms/fetch-parse",
        headers={"X-Internal-Key": "k" * 40},
        json={"source": "VIIRS_SNPP_NRT", "bbox": [100, -5, 101, -4], "days": 2},
    )
    assert response.status_code == 200
    assert response.json()["hotspots"][0]["confidence_raw"] == "h"
    assert response.json()["hotspots"][0]["confidence_level"] == "high"
    assert response.json()["hotspots"][0]["frp"] == 12.0
    assert key not in response.text
    assert observed == {
        "map_key": key,
        "source": "VIIRS_SNPP_NRT",
        "bbox": (100.0, -5.0, 101.0, -4.0),
        "days": 2,
    }

