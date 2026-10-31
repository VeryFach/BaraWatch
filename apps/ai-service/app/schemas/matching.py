
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictSchema(BaseModel):
    model_config = ConfigDict(extra="forbid")


def validate_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timestamp must include a timezone")
    return value


class VisionEvidence(StrictSchema):
    fire: float = Field(default=0.0, ge=0, le=1)
    smoke_general: float = Field(default=0.0, ge=0, le=1)
    wildfire_smoke: float = Field(default=0.0, ge=0, le=1)
    industrial_smoke: float = Field(default=0.0, ge=0, le=1)
    needs_review: bool = False


class ReportEvidence(StrictSchema):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    observed_at: datetime
    vision: VisionEvidence

    @field_validator("observed_at")
    @classmethod
    def check_observed_at(cls, value: datetime) -> datetime:
        return validate_timestamp(value)


class HotspotEvidence(StrictSchema):
    hotspot_id: str = Field(min_length=1, max_length=128)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    acq_at: datetime

    @field_validator("acq_at")
    @classmethod
    def check_acq_at(cls, value: datetime) -> datetime:
        return validate_timestamp(value)


class MatchingRequest(StrictSchema):
    report: ReportEvidence
    hotspots: list[HotspotEvidence] = Field(
        default_factory=list,
        max_length=5000,
    )
    radius_km: float = Field(default=5.0, gt=0, le=50)
    time_window_hours: float = Field(
        default=24.0, gt=0, le=168
    )
    threshold: float = Field(
        default=0.75, ge=0, le=1
    )


class MatchedHotspot(StrictSchema):
    hotspot_id: str
    distance_m: float
    time_difference_minutes: float
    spatial_score: float
    temporal_score: float
    combined_score: float


class MatchingResponse(StrictSchema):
    status: Literal["success"] = "success"
    algorithm: str = "spatiotemporal-rule-v1"
    decision: Literal[
        "auto_pass", "uncertain", "rejected"
    ]
    verification_score: float
    needs_review: bool
    matched_hotspot: MatchedHotspot | None
    candidates_within_window: int
    reasons: list[str]
