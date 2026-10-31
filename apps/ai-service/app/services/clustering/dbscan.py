import math

import numpy as np
from shapely.geometry import MultiPoint, mapping
from sklearn.cluster import DBSCAN

from app.schemas.clustering import (
    Cluster,
    ClusterRequest,
    ClusterResponse,
    Hotspot,
)

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1, lon1, lat2, lon2):
    """Menghitung jarak permukaan Bumi dalam kilometer."""

    a, b, c, d = map(
        math.radians,
        [lat1, lon1, lat2, lon2],
    )

    x = (
        math.sin((c - a) / 2) ** 2
        + math.cos(a)
        * math.cos(c)
        * math.sin((d - b) / 2) ** 2
    )

    return (
        2
        * EARTH_RADIUS_KM
        * math.asin(min(1, math.sqrt(x)))
    )


def confidence_ok(hotspot: Hotspot, threshold: str):

    if threshold == "all":
        return True

    if threshold == "nominal":
        return hotspot.confidence_level in {
            "nominal", "high"
        }

    if threshold == "high":
        return hotspot.confidence_level == "high"

    return False


def create_footprint(hotspots):
    """
    Convex hull untuk visualisasi cluster.
    Bukan estimasi area yang terbakar.
    """

    coordinates = [
        (h.longitude, h.latitude)
        for h in hotspots
    ]

    geometry = MultiPoint(coordinates).convex_hull

    if geometry.geom_type != "Polygon":
        return None

    return mapping(geometry)


def cluster_hotspots(
    request: ClusterRequest,
) -> ClusterResponse:

    # 1. Validasi ID
    ids = [h.id for h in request.hotspots]

    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate hotspot IDs")

    # 2. Confidence filtering
    kept = [
        h for h in request.hotspots
        if confidence_ok(
            h, request.minimum_confidence
        )
    ]

    filtered = sorted([
        h.id for h in request.hotspots
        if not confidence_ok(
            h, request.minimum_confidence
        )
    ])

    kept.sort(key=lambda h: (h.acq_at, h.id))

    if not kept:
        return ClusterResponse(
            clusters=[],
            noise_hotspot_ids=[],
            filtered_hotspot_ids=filtered,
            input_count=len(request.hotspots),
        )

    # 3. Pemisahan berdasarkan jeda waktu
    segments = []
    current = []

    for hotspot in kept:

        if current:
            time_gap = (
                hotspot.acq_at - current[-1].acq_at
            ).total_seconds()

            if (
                time_gap
                > request.max_time_gap_hours * 3600
            ):
                segments.append(current)
                current = []

        current.append(hotspot)

    if current:
        segments.append(current)

    # 4. DBSCAN pada masing-masing segment
    groups = []
    noise = []

    for segment in segments:

        coordinates = np.radians(
            np.array([
                [h.latitude, h.longitude]
                for h in segment
            ], dtype=np.float64)
        )

        model = DBSCAN(
            eps=request.eps_km / EARTH_RADIUS_KM,
            min_samples=request.min_samples,
            metric="haversine",
            algorithm="ball_tree",
        )

        labels = model.fit_predict(coordinates)

        for label in sorted(set(labels)):

            selected = [
                h
                for h, assigned_label in zip(
                    segment, labels
                )
                if assigned_label == label
            ]

            if label == -1:
                noise.extend(
                    h.id for h in selected
                )
            else:
                groups.append(selected)

    # 5. Bentuk kandidat insiden
    results = []
    used_incidents = set()

    for index, group in enumerate(groups):

        latitude = (
            sum(h.latitude for h in group)
            / len(group)
        )

        longitude = (
            sum(h.longitude for h in group)
            / len(group)
        )

        first_detected = min(
            h.acq_at for h in group
        )

        last_detected = max(
            h.acq_at for h in group
        )

        # 6. Cocokkan dengan insiden aktif
        candidates = []

        for incident in request.open_incidents:

            if incident.id in used_incidents:
                continue

            if incident.last_detected_at is not None:

                if incident.last_detected_at.tzinfo is None:
                    continue

                time_difference = abs(
                    (
                        last_detected
                        - incident.last_detected_at
                    ).total_seconds()
                )

                if (
                    time_difference
                    > request.max_time_gap_hours * 3600
                ):
                    continue

            distance = haversine_km(
                latitude,
                longitude,
                incident.latitude,
                incident.longitude,
            )

            if distance <= request.match_radius_km:
                candidates.append(
                    (distance, incident.id)
                )

        matched_id = (
            min(candidates)[1]
            if candidates
            else None
        )

        if matched_id:
            used_incidents.add(matched_id)

        cluster = Cluster(
            cluster_id=f"cluster-{index}",
            hotspot_ids=sorted(
                h.id for h in group
            ),
            hotspot_count=len(group),
            centroid={
                "latitude": round(latitude, 7),
                "longitude": round(longitude, 7),
            },
            footprint=create_footprint(group),
            first_detected_at=first_detected,
            last_detected_at=last_detected,
            matched_incident_id=matched_id,
        )

        results.append(cluster)

    return ClusterResponse(
        clusters=results,
        noise_hotspot_ids=sorted(noise),
        filtered_hotspot_ids=filtered,
        input_count=len(request.hotspots),
    )