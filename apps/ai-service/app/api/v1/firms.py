"""Internal NASA FIRMS CSV adapter used by the backend orchestrator."""

import hmac
import math

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.config import get_settings
from app.services.firms import (
    ALLOWED_SOURCES,
    MAX_FIRMS_RESPONSE_BYTES,
    download_firms_csv,
    parse_firms_csv,
)

router = APIRouter(prefix="/v1/firms", tags=["FIRMS"])


class FirmsFetchRequest(BaseModel):
    source: str
    bbox: tuple[float, float, float, float]
    days: int = Field(default=1, ge=1, le=5)

    @field_validator("source")
    @classmethod
    def allowed_source(cls, value: str) -> str:
        if value not in ALLOWED_SOURCES:
            raise ValueError("Unsupported FIRMS source")
        return value

    @field_validator("bbox")
    @classmethod
    def valid_bbox(cls, value: tuple[float, float, float, float]):
        west, south, east, north = value
        if not all(math.isfinite(v) for v in value) or not (
            -180 <= west < east <= 180 and -90 <= south < north <= 90
        ):
            raise ValueError("Invalid bounding box")
        return value


@router.post("/fetch-parse")
def fetch_parse(
    payload: FirmsFetchRequest,
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
):
    settings = get_settings()
    expected = settings.ai_internal_key
    if not expected:
        raise HTTPException(status_code=503, detail="Internal API key not configured")
    if x_internal_key is None or not hmac.compare_digest(x_internal_key, expected):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not settings.firms_map_key:
        raise HTTPException(status_code=503, detail="FIRMS is not configured")
    try:
        csv_content = download_firms_csv(
            settings.firms_map_key, payload.source, payload.bbox, payload.days
        )
        if len(csv_content.encode("utf-8")) > MAX_FIRMS_RESPONSE_BYTES:
            raise ValueError("FIRMS response exceeds limit")
        hotspots = parse_firms_csv(csv_content)
        if len(hotspots) > 20_000:
            raise ValueError("FIRMS record count exceeds limit")
        if any(not hotspot.satellite or not hotspot.instrument for hotspot in hotspots):
            raise ValueError("FIRMS record is missing satellite or instrument")
        return {
            "source": payload.source,
            "count": len(hotspots),
            "hotspots": [hotspot.model_dump(mode="json") for hotspot in hotspots],
        }
    except Exception as exc:
        # Avoid surfacing request URLs, upstream bodies, or configured credentials.
        raise HTTPException(status_code=502, detail="FIRMS fetch or parse failed") from exc
