from app.schemas.risk import (
    RiskComponents,
    RiskRequest,
    RiskResponse,
)

ACTIVITY_REFERENCE_PER_DAY = 20.0
FRP_REFERENCE_MW = 20.0

LOW_UPPER_BOUND = 35.0
MODERATE_UPPER_BOUND = 70.0


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def calculate_risk(payload: RiskRequest) -> RiskResponse:
    limitations = [
        "Heuristic hotspot activity index, not calibrated fire probability",
        "No weather, peatland, land-cover, or historical fire labels",
        "Satellite non-detection does not establish absence of fire",
    ]

    if payload.hotspot_count == 0:
        return RiskResponse(
            region_id=payload.region_id,
            risk_score=None,
            risk_level="insufficient_data",
            components=RiskComponents(
                activity=0.0,
                eligible_ratio=0.0,
                frp=None,
            ),
            reasons=["no_hotspot_observations"],
            limitations=limitations,
        )

    per_day = (
        payload.hotspot_count * 24.0 / payload.window_hours
    )

    activity = clamp01(
        per_day / ACTIVITY_REFERENCE_PER_DAY
    )

    eligible_ratio = (
        payload.eligible_count / payload.hotspot_count
    )

    frp_component = (
        clamp01(payload.frp_mean_mw / FRP_REFERENCE_MW)
        if payload.frp_mean_mw is not None
        else None
    )

    weighted_sum = (
        0.50 * activity
        + 0.20 * eligible_ratio
    )
    total_weight = 0.70

    if frp_component is not None:
        weighted_sum += 0.30 * frp_component
        total_weight += 0.30

    score = round(
        100.0 * weighted_sum / total_weight,
        2,
    )

    if score < LOW_UPPER_BOUND:
        level = "low"
    elif score < MODERATE_UPPER_BOUND:
        level = "moderate"
    else:
        level = "high"

    reasons: list[str] = []

    if activity >= 0.75:
        reasons.append("high_hotspot_activity")
    elif activity >= 0.35:
        reasons.append("moderate_hotspot_activity")
    else:
        reasons.append("low_hotspot_activity")

    if eligible_ratio < 0.5:
        reasons.append("many_hotspots_require_review")

    if frp_component is None:
        reasons.append("frp_unavailable")
        limitations.append(
            "FRP component omitted and remaining weights renormalized"
        )
    elif frp_component >= 0.75:
        reasons.append("elevated_mean_frp")

    return RiskResponse(
        region_id=payload.region_id,
        risk_score=score,
        risk_level=level,
        components=RiskComponents(
            activity=round(activity, 6),
            eligible_ratio=round(eligible_ratio, 6),
            frp=(
                round(frp_component, 6)
                if frp_component is not None
                else None
            ),
        ),
        reasons=reasons,
        limitations=limitations,
    )