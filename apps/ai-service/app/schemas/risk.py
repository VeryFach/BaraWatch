from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        allow_inf_nan=False,
    )


class RiskRequest(StrictModel):
    region_id: str = Field(min_length=1, max_length=128)
    window_hours: float = Field(default=120, gt=0, le=720)
    hotspot_count: int = Field(ge=0)
    eligible_count: int = Field(ge=0)
    review_count: int = Field(ge=0)
    frp_max_mw: float | None = Field(default=None, ge=0)
    frp_mean_mw: float | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def check_counts(self):
        if self.eligible_count + self.review_count != self.hotspot_count:
            raise ValueError(
                "eligible_count + review_count must equal hotspot_count"
            )

        if self.hotspot_count == 0 and (
            self.frp_max_mw is not None
            or self.frp_mean_mw is not None
        ):
            raise ValueError("FRP must be null when hotspot_count is zero")

        if (
            self.frp_max_mw is not None
            and self.frp_mean_mw is not None
            and self.frp_mean_mw > self.frp_max_mw
        ):
            raise ValueError("frp_mean_mw cannot exceed frp_max_mw")

        return self


class RiskComponents(StrictModel):
    activity: float
    eligible_ratio: float
    frp: float | None


class RiskResponse(StrictModel):
    status: Literal["success"] = "success"
    algorithm: str = "hotspot-activity-index-v1"
    region_id: str
    risk_score: float | None
    risk_level: Literal["low", "moderate", "high", "insufficient_data"]
    components: RiskComponents
    reasons: list[str]
    limitations: list[str]