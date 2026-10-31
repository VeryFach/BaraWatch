from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class BurnAreaRequest(StrictModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_km: float = Field(default=2, gt=0, le=5)
    pre_start: date
    pre_end: date
    post_start: date
    post_end: date
    dnbr_threshold: float = Field(default=0.10, ge=-1, le=1)
    max_cloud_percent: float = Field(default=60, ge=0, le=100)
    max_scenes_per_period: int = Field(default=3, ge=1, le=5)
    save_geotiff: bool = False

    @model_validator(mode="after")
    def check_dates(self):
        if not (self.pre_start < self.pre_end <= self.post_start < self.post_end):
            raise ValueError("Require pre_start < pre_end <= post_start < post_end")
        if (self.pre_end - self.pre_start).days > 90 or (self.post_end - self.post_start).days > 90:
            raise ValueError("Each date interval must be at most 90 days")
        return self


class BurnAreaResponse(StrictModel):
    status: Literal["success"] = "success"
    algorithm: str = "copernicus-sentinel2-dnbr-v1"
    provider: str = "copernicus-data-space"
    indicated_area_ha: float = Field(ge=0)
    valid_area_ha: float = Field(ge=0)
    analysis_area_ha: float = Field(ge=0)
    valid_coverage_percent: float = Field(ge=0, le=100)
    pre_image_count: int = Field(ge=0)
    post_image_count: int = Field(ge=0)
    pre_scene_ids: list[str]
    post_scene_ids: list[str]
    dnbr_threshold: float
    quality: Literal["adequate", "limited"]
    raster_path: str | None = None
    limitations: list[str]
