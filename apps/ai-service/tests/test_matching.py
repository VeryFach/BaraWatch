
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.api.v1.matching import router
from app.schemas.matching import (
    HotspotEvidence,
    MatchingRequest,
    ReportEvidence,
    VisionEvidence,
)
from app.services.matching.spatiotemporal import (
    haversine_km,
    match_report,
)

NOW = datetime(
    2026, 10, 30, 12, 0, tzinfo=timezone.utc
)


def build_request(
    *,
    distance_lat: float = 0.0,
    hour_offset: float = 0.0,
    fire: float = 0.9,
    industrial_smoke: float = 0.0,
    needs_review: bool = False,
    with_hotspot: bool = True,
) -> MatchingRequest:
    return MatchingRequest(
        report=ReportEvidence(
            latitude=-2.21,
            longitude=113.92,
            observed_at=NOW,
            vision=VisionEvidence(
                fire=fire,
                industrial_smoke=industrial_smoke,
                needs_review=needs_review,
            ),
        ),
        hotspots=(
            [
                HotspotEvidence(
                    hotspot_id="test-001",
                    latitude=-2.21 + distance_lat,
                    longitude=113.92,
                    acq_at=NOW
                    - timedelta(hours=hour_offset),
                )
            ]
            if with_hotspot
            else []
        ),
    )


def test_haversine_same_point():
    assert haversine_km(
        -2.21, 113.92, -2.21, 113.92
    ) == pytest.approx(0.0)


def test_haversine_one_degree_latitude():
    distance = haversine_km(0, 0, 1, 0)
    assert 110 < distance < 112


def test_matching_positive():
    result = match_report(build_request())

    assert result.decision == "auto_pass"
    assert result.needs_review is False
    assert result.matched_hotspot is not None
    assert result.matched_hotspot.hotspot_id == "test-001"
    assert result.verification_score >= 0.75


def test_hotspot_too_far():
    result = match_report(
        build_request(distance_lat=1.0)
    )

    assert result.decision == "uncertain"
    assert result.matched_hotspot is None
    assert result.candidates_within_window == 0


def test_hotspot_too_old():
    result = match_report(
        build_request(hour_offset=48)
    )

    assert result.decision == "uncertain"
    assert result.matched_hotspot is None


def test_no_hotspot():
    result = match_report(
        build_request(with_hotspot=False)
    )

    assert result.decision == "uncertain"
    assert result.needs_review is True
    assert result.verification_score == 0.0


def test_weak_visual_evidence():
    result = match_report(
        build_request(fire=0.1)
    )

    assert result.decision == "uncertain"
    assert result.needs_review is True


def test_industrial_conflict():
    result = match_report(
        build_request(
            fire=0.9,
            industrial_smoke=0.9,
        )
    )

    assert result.decision == "uncertain"
    assert "possible_industrial_smoke" in result.reasons


def test_vision_review_flag():
    result = match_report(
        build_request(needs_review=True)
    )

    assert result.decision == "uncertain"
    assert result.needs_review is True


def test_invalid_latitude():
    with pytest.raises(ValidationError):
        ReportEvidence(
            latitude=120.0,
            longitude=113.92,
            observed_at=NOW,
            vision=VisionEvidence(),
        )


def test_naive_timestamp_rejected():
    with pytest.raises(ValidationError):
        HotspotEvidence(
            hotspot_id="test",
            latitude=0,
            longitude=0,
            acq_at=datetime(2026, 10, 30),
        )


def test_api_requires_key(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    payload = build_request().model_dump(mode="json")

    response = client.post(
        "/v1/matching/score",
        json=payload,
    )

    assert response.status_code == 401


def test_api_success(monkeypatch):
    monkeypatch.setenv("AI_INTERNAL_KEY", "test-secret")

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    payload = build_request().model_dump(mode="json")

    response = client.post(
        "/v1/matching/score",
        headers={"X-Internal-Key": "test-secret"},
        json=payload,
    )

    assert response.status_code == 200

    result = response.json()
    assert result["decision"] == "auto_pass"
    assert result["matched_hotspot"]["hotspot_id"] == "test-001"
