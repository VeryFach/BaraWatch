from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class Hotspot(BaseModel):
    id: str = Field(min_length=1, max_length=180)

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    acq_at: datetime

    satellite: str | None = None
    instrument: str | None = None
    confidence_raw: str | None = None

    confidence_level: Literal[
        "low", "nominal", "high", "unknown"
    ] = "unknown"

    frp: float | None = Field(default=None, ge=0)

    @field_validator("acq_at")
    @classmethod
    def timezone_required(cls, value: datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(
                "acq_at must include timezone"
            )
        return value


class OpenIncident(BaseModel):
    id: str = Field(min_length=1)

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)

    last_detected_at: datetime | None = None


class ClusterRequest(BaseModel):
    hotspots: list[Hotspot] = Field(
        default_factory=list,
        max_length=20000,
    )

    open_incidents: list[OpenIncident] = Field(
        default_factory=list,
        max_length=1000,
    )

    eps_km: float = Field(default=1.5, gt=0, le=100)
    min_samples: int = Field(default=2, ge=1, le=100)

    max_time_gap_hours: float = Field(
        default=24,
        gt=0,
        le=168,
    )

    match_radius_km: float = Field(
        default=1.5,
        gt=0,
        le=100,
    )

    minimum_confidence: Literal[
        "all", "nominal", "high"
    ] = "nominal"


class Cluster(BaseModel):
    cluster_id: str
    hotspot_ids: list[str]
    hotspot_count: int

    centroid: dict[str, float]
    footprint: dict | None = None

    first_detected_at: datetime
    last_detected_at: datetime

    matched_incident_id: str | None = None


class ClusterResponse(BaseModel):
    clusters: list[Cluster]

    noise_hotspot_ids: list[str]
    filtered_hotspot_ids: list[str]

    algorithm: str = "dbscan-haversine-v1"
    input_count: int