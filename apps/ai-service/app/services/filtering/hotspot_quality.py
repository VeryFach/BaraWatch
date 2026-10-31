
from collections import Counter

from app.schemas.hotspot_filter import (
    FilterRequest,
    FilterResponse,
    FilterResult,
    FilterSummary,
)
from app.services.matching.spatiotemporal import haversine_km


def filter_hotspots(request: FilterRequest) -> FilterResponse:
    results: list[FilterResult] = []
    reason_counts: Counter[str] = Counter()

    for hotspot in request.hotspots:
        reasons: list[str] = []
        heat_source_id = None

        if (
            request.config.review_low_confidence
            and hotspot.confidence == "l"
        ):
            reasons.append("low_viirs_confidence")

        if (
            request.config.review_missing_frp
            and hotspot.frp is None
        ):
            reasons.append("missing_frp")

        threshold = request.config.review_below_frp_mw

        if (
            threshold is not None
            and hotspot.frp is not None
            and hotspot.frp < threshold
        ):
            reasons.append("below_experimental_frp_threshold")

        for zone in request.known_heat_sources:
            distance = haversine_km(
                hotspot.latitude,
                hotspot.longitude,
                zone.latitude,
                zone.longitude,
            )

            if distance <= zone.radius_km:
                heat_source_id = zone.zone_id
                reasons.append("near_known_heat_source")
                break

        # Important: review does not mean false positive.
        decision = "review" if reasons else "eligible"

        result = FilterResult(
            hotspot_id=hotspot.hotspot_id,
            decision=decision,
            reasons=reasons,
            matched_heat_source_id=heat_source_id,
        )

        results.append(result)
        reason_counts.update(reasons)

    eligible_count = sum(
        result.decision == "eligible"
        for result in results
    )

    review_count = len(results) - eligible_count

    return FilterResponse(
        summary=FilterSummary(
            total=len(results),
            eligible=eligible_count,
            review=review_count,
            by_reason=dict(sorted(reason_counts.items())),
        ),
        results=results,
    )