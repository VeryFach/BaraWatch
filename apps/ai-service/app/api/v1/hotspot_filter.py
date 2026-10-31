from fastapi import APIRouter, Header

from app.api.v1.matching import verify_internal_key
from app.schemas.hotspot_filter import (
    FilterRequest,
    FilterResponse,
)
from app.services.filtering.hotspot_quality import (
    filter_hotspots,
)

router = APIRouter(
    prefix="/v1/hotspots",
    tags=["Hotspot Filtering"],
)


@router.post(
    "/filter",
    response_model=FilterResponse,
)
def filter_endpoint(
    payload: FilterRequest,
    x_internal_key: str | None = Header(
        default=None,
        alias="X-Internal-Key",
    ),
) -> FilterResponse:
    verify_internal_key(x_internal_key)
    return filter_hotspots(payload)