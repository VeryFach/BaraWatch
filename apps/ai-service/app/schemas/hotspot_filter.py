
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        allow_inf_nan=False,
    )


class HotspotInput(StrictModel):
    hotspot_id: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    confidence: Literal["l", "n", "h"]
    frp: float | None = Field(default=None, ge=0)
    daynight: Literal["D", "N"]
    satellite: str | None = None
    acq_at: str | None = None

    @field_validator("confidence", mode="before")
    @classmethod
    def normalize_confidence(cls, value):
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @field_validator("daynight", mode="before")
    @classmethod
    def normalize_daynight(cls, value):
        if isinstance(value, str):
            return value.strip().upper()
        return value


class KnownHeatSource(StrictModel):
    zone_id: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(gt=0, le=100)


class FilterConfig(StrictModel):
    review_low_confidence: bool = True
    review_missing_frp: bool = True

    # Experimental flag only, not a fire probability.
    # Disabled by default to avoid excluding weak fires.
    review_below_frp_mw: float | None = Field(
        default=None, ge=0
    )


class FilterRequest(StrictModel):
    hotspots: list[HotspotInput] = Field(
        max_length=5000
    )
    known_heat_sources: list[KnownHeatSource] = Field(
        default_factory=list,
        max_length=500,
    )
    config: FilterConfig = Field(
        default_factory=FilterConfig
    )


class FilterResult(StrictModel):
    hotspot_id: str
    decision: Literal["eligible", "review"]
    reasons: list[str]
    matched_heat_source_id: str | None = None


class FilterSummary(StrictModel):
    total: int
    eligible: int
    review: int
    by_reason: dict[str, int]


class FilterResponse(StrictModel):
    status: Literal["success"] = "success"
    algorithm: str = "hotspot-quality-v1"
    summary: FilterSummary
    results: list[FilterResult]