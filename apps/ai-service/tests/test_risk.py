import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.risk import router
from app.schemas.risk import RiskRequest
from app.services.risk.rule_based import calculate_risk


def make_request(**overrides):
    payload = {
        "region_id": "test-kalteng",
        "window_hours": 120,
        "hotspot_count": 100,
        "eligible_count": 80,
        "review_count": 20,
        "frp_mean_mw": 10.0,
        "frp_max_mw": 30.0,
    }
    payload.update(overrides)
    return RiskRequest(**payload)


def test_risk_score_bounded():
    result = calculate_risk(make_request())
    assert result.risk_score is not None
    assert 0 <= result.risk_score <= 100


def test_high_activity():
    result = calculate_risk(
        make_request(
            hotspot_count=500,
            eligible_count=450,
            review_count=50,
            frp_mean_mw=20,
        )
    )
    assert result.risk_level == "high"


def test_low_activity():
    result = calculate_risk(
        make_request(
            hotspot_count=1,
            eligible_count=1,
            review_count=0,
            frp_mean_mw=0.5,
            frp_max_mw=0.5,
        )
    )
    assert result.risk_level == "low"


def test_no_observations_not_low_risk():
    result = calculate_risk(
        make_request(
            hotspot_count=0,
            eligible_count=0,
            review_count=0,
            frp_mean_mw=None,
            frp_max_mw=None,
        )
    )
    assert result.risk_level == "insufficient_data"
    assert result.risk_score is None


def test_missing_frp():
    result = calculate_risk(
        make_request(
            frp_mean_mw=None,
            frp_max_mw=None,
        )
    )
    assert result.risk_score is not None
    assert result.components.frp is None
    assert "frp_unavailable" in result.reasons


def test_invalid_counts():
    with pytest.raises(ValidationError):
        make_request(eligible_count=90, review_count=20)


def test_invalid_frp():
    with pytest.raises(ValidationError):
        make_request(frp_mean_mw=-1)


def test_invalid_frp_consistency():
    with pytest.raises(ValidationError):
        make_request(frp_mean_mw=40, frp_max_mw=20)


def test_invalid_window():
    with pytest.raises(ValidationError):
        make_request(window_hours=0)


def test_review_heavy():
    result = calculate_risk(
        make_request(
            eligible_count=20,
            review_count=80,
        )
    )
    assert "many_hotspots_require_review" in result.reasons


def test_api_unauthorized(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post(
        "/v1/risk/score",
        json=make_request().model_dump(mode="json"),
    )
    assert response.status_code == 401


def test_api_success(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post(
        "/v1/risk/score",
        headers={"X-Internal-Key": "test-secret"},
        json=make_request().model_dump(mode="json"),
    )

    assert response.status_code == 200
    assert response.json()["algorithm"] == "hotspot-activity-index-v1"