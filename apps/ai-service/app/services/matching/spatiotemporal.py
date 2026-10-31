
from math import asin, cos, radians, sin, sqrt

from app.schemas.matching import (
    MatchedHotspot,
    MatchingRequest,
    MatchingResponse,
)

EARTH_RADIUS_KM = 6371.0088

VISUAL_WEIGHT = 0.40
SPATIAL_WEIGHT = 0.35
TEMPORAL_WEIGHT = 0.25

INDUSTRIAL_REVIEW_THRESHOLD = 0.60
MIN_VISUAL_FOR_AUTO_PASS = 0.50


def haversine_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Great-circle distance between two WGS84 points."""
    phi1 = radians(lat1)
    phi2 = radians(lat2)
    delta_phi = radians(lat2 - lat1)

    # Normalize longitude difference across the dateline.
    delta_lambda = radians(
        (lon2 - lon1 + 180) % 360 - 180
    )

    a = (
        sin(delta_phi / 2) ** 2
        + cos(phi1)
        * cos(phi2)
        * sin(delta_lambda / 2) ** 2
    )
    a = min(1.0, max(0.0, a))

    return 2 * EARTH_RADIUS_KM * asin(sqrt(a))


def visual_evidence_score(vision) -> float:
    """
    Use positive visual evidence.

    General smoke is weaker evidence than identified
    fire or wildfire smoke. Scores are heuristics,
    not calibrated probabilities.
    """
    return max(
        vision.fire,
        vision.wildfire_smoke,
        vision.smoke_general * 0.5,
    )


def match_report(
    request: MatchingRequest,
) -> MatchingResponse:
    report = request.report
    visual_score = visual_evidence_score(report.vision)

    industrial_conflict = (
        report.vision.industrial_smoke
        >= INDUSTRIAL_REVIEW_THRESHOLD
    )

    window_minutes = request.time_window_hours * 60

    candidates: list[MatchedHotspot] = []

    for hotspot in request.hotspots:
        distance_km = haversine_km(
            report.latitude,
            report.longitude,
            hotspot.latitude,
            hotspot.longitude,
        )

        delta_minutes = abs(
            (
                report.observed_at - hotspot.acq_at
            ).total_seconds()
        ) / 60

        if distance_km > request.radius_km:
            continue

        if delta_minutes > window_minutes:
            continue

        spatial_score = max(
            0.0,
            1.0 - distance_km / request.radius_km,
        )

        temporal_score = max(
            0.0,
            1.0 - delta_minutes / window_minutes,
        )

        combined_score = (
            VISUAL_WEIGHT * visual_score
            + SPATIAL_WEIGHT * spatial_score
            + TEMPORAL_WEIGHT * temporal_score
        )

        candidates.append(
            MatchedHotspot(
                hotspot_id=hotspot.hotspot_id,
                distance_m=round(distance_km * 1000, 2),
                time_difference_minutes=round(
                    delta_minutes, 2
                ),
                spatial_score=round(spatial_score, 6),
                temporal_score=round(temporal_score, 6),
                combined_score=round(combined_score, 6),
            )
        )

    # Highest scoring candidate wins.
    # Deterministic tie-breakers for reproducible tests.
    candidates.sort(
        key=lambda item: (
            -item.combined_score,
            item.distance_m,
            item.time_difference_minutes,
            item.hotspot_id,
        )
    )

    best = candidates[0] if candidates else None

    reasons = []

    if best is None:
        reasons.append("no_hotspot_within_search_window")
    else:
        reasons.append("satellite_candidate_found")

    if visual_score < MIN_VISUAL_FOR_AUTO_PASS:
        reasons.append("weak_visual_evidence")
    else:
        reasons.append("positive_visual_evidence")

    if industrial_conflict:
        reasons.append("possible_industrial_smoke")

    if report.vision.needs_review:
        reasons.append("vision_requires_review")

    score = best.combined_score if best else 0.0

    auto_pass = (
        best is not None
        and score >= request.threshold
        and visual_score >= MIN_VISUAL_FOR_AUTO_PASS
        and not industrial_conflict
        and not report.vision.needs_review
    )

    if auto_pass:
        decision = "auto_pass"
        needs_review = False
        reasons.append("automatic_screening_passed")
    else:
        decision = "uncertain"
        needs_review = True
        reasons.append("human_verification_required")

    return MatchingResponse(
        decision=decision,
        verification_score=round(score, 6),
        needs_review=needs_review,
        matched_hotspot=best,
        candidates_within_window=len(candidates),
        reasons=reasons,
    )
