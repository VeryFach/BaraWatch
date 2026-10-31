import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.hotspot_filter import router
from app.schemas.hotspot_filter import (
    FilterConfig,
    FilterRequest,
    HotspotInput,
    KnownHeatSource,
)
from app.services.filtering.hotspot_quality import (
    filter_hotspots,
)


def hotspot(
    hotspot_id="h1",
    confidence="n",
    frp=3.5,
    latitude=-2.21,
    longitude=113.92,
):
    return HotspotInput(
        hotspot_id=hotspot_id,
        latitude=latitude,
        longitude=longitude,
        confidence=confidence,
        frp=frp,
        daynight="D",
    )


def test_nominal_confidence_eligible():
    result = filter_hotspots(
        FilterRequest(hotspots=[hotspot()])
    )
    assert result.results[0].decision == "eligible"


def test_low_confidence_requires_review():
    result = filter_hotspots(
        FilterRequest(
            hotspots=[hotspot(confidence="l")]
        )
    )
    assert result.results[0].decision == "review"
    assert "low_viirs_confidence" in result.results[0].reasons


def test_high_confidence_eligible():
    result = filter_hotspots(
        FilterRequest(
            hotspots=[hotspot(confidence="h")]
        )
    )
    assert result.summary.eligible == 1


def test_missing_frp_requires_review():
    result = filter_hotspots(
        FilterRequest(hotspots=[hotspot(frp=None)])
    )
    assert "missing_frp" in result.results[0].reasons


def test_low_frp_is_not_rejected_by_default():
    result = filter_hotspots(
        FilterRequest(hotspots=[hotspot(frp=0.1)])
    )
    assert result.results[0].decision == "eligible"


def test_experimental_frp_threshold():
    result = filter_hotspots(
        FilterRequest(
            hotspots=[hotspot(frp=0.5)],
            config=FilterConfig(
                review_below_frp_mw=2.0,
            ),
        )
    )
    assert result.results[0].decision == "review"


def test_known_heat_source():
    result = filter_hotspots(
        FilterRequest(
            hotspots=[hotspot()],
            known_heat_sources=[
                KnownHeatSource(
                    zone_id="known-source-1",
                    latitude=-2.21,
                    longitude=113.92,
                    radius_km=1.0,
                )
            ],
        )
    )
    assert result.results[0].decision == "review"
    assert (
        result.results[0].matched_heat_source_id
        == "known-source-1"
    )


def test_outside_heat_source():
    result = filter_hotspots(
        FilterRequest(
            hotspots=[hotspot()],
            known_heat_sources=[
                KnownHeatSource(
                    zone_id="far-source",
                    latitude=-3.5,
                    longitude=114.5,
                    radius_km=1.0,
                )
            ],
        )
    )
    assert result.summary.eligible == 1


def test_count_integrity():
    result = filter_hotspots(
        FilterRequest(
            hotspots=[
                hotspot("a", "n"),
                hotspot("b", "l"),
                hotspot("c", "h"),
            ]
        )
    )
    assert result.summary.total == 3
    assert result.summary.eligible == 2
    assert result.summary.review == 1
    assert (
        result.summary.eligible + result.summary.review
        == result.summary.total
    )


def test_invalid_coordinates():
    with pytest.raises(ValidationError):
        hotspot(latitude=100)


def test_invalid_confidence():
    with pytest.raises(ValidationError):
        hotspot(confidence="invalid")


def test_api_requires_key(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post(
        "/v1/hotspots/filter",
        json={"hotspots": []},
    )
    assert response.status_code == 401


def test_api_success(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    response = client.post(
        "/v1/hotspots/filter",
        headers={"X-Internal-Key": "test-secret"},
        json={
            "hotspots": [
                {
                    "hotspot_id": "test-001",
                    "latitude": -2.21,
                    "longitude": 113.92,
                    "confidence": "n",
                    "frp": 5,
                    "daynight": "D",
                }
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["summary"]["eligible"] == 1