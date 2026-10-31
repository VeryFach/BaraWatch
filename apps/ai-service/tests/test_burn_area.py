from datetime import date

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.burn_area import router
from app.schemas.burn_area import BurnAreaRequest, BurnAreaResponse
from app.services.burn_area.dnbr import calculate_dnbr, calculate_nbr, square_meters_to_hectares


def request():
    return BurnAreaRequest(latitude=-2.21, longitude=113.92, radius_km=2,
                           pre_start=date(2026, 7, 1), pre_end=date(2026, 7, 16),
                           post_start=date(2026, 8, 1), post_end=date(2026, 8, 16))


def test_nbr():
    assert calculate_nbr(.6, .2) == pytest.approx(.5)


def test_dnbr():
    assert calculate_dnbr(.6, .2, .2, .3) == pytest.approx(.7)


def test_invalid_reflectance():
    with pytest.raises(ValueError):
        calculate_nbr(0, 0)


def test_hectares():
    assert square_meters_to_hectares(10000) == 1


def test_bad_radius():
    with pytest.raises(ValidationError):
        BurnAreaRequest.model_validate({**request().model_dump(), "radius_km": 10})


def test_bad_dates():
    with pytest.raises(ValidationError):
        BurnAreaRequest.model_validate({**request().model_dump(), "post_start": "2026-06-01"})


def test_auth(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")
    app = FastAPI()
    app.include_router(router)
    response = TestClient(app).post(
        "/v1/burn-area/estimate",
        json=request().model_dump(mode="json"),
    )
    assert response.status_code == 401


def test_api_mock(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")
    expected = BurnAreaResponse(
        indicated_area_ha=10, valid_area_ha=100, analysis_area_ha=120,
        valid_coverage_percent=83.33, pre_image_count=2, post_image_count=2,
        pre_scene_ids=["pre"], post_scene_ids=["post"],
        dnbr_threshold=.1, quality="adequate", limitations=["Mock"])
    monkeypatch.setattr("app.api.v1.burn_area.estimate_burn_area", lambda _: expected)
    app = FastAPI()
    app.include_router(router)
    response = TestClient(app).post("/v1/burn-area/estimate",
                                    json=request().model_dump(mode="json"),
                                    headers={"X-Internal-Key": "test-secret"})
    assert response.status_code == 200
    assert response.json()["indicated_area_ha"] == 10
