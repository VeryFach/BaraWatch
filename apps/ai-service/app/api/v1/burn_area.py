import logging

from fastapi import APIRouter, Header, HTTPException

from app.api.v1.matching import verify_internal_key
from app.schemas.burn_area import BurnAreaRequest, BurnAreaResponse
from app.services.burn_area.copernicus_client import BurnAreaDataError
from app.services.burn_area.estimator import estimate_burn_area

logger = logging.getLogger("barawatch")
router = APIRouter(prefix="/v1/burn-area", tags=["Burn Area Estimation"])


@router.post("/estimate", response_model=BurnAreaResponse)
def estimate_endpoint(
    payload: BurnAreaRequest,
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
) -> BurnAreaResponse:
    verify_internal_key(x_internal_key)
    try:
        return estimate_burn_area(payload)
    except BurnAreaDataError as exc:
        # No image data or unsupported scene. 422 means not processable for these inputs.
        logger.warning("Burn area imagery unavailable: %s", exc)
        raise HTTPException(status_code=422, detail="No usable imagery for this request") from exc
    except Exception:
        logger.exception("Copernicus burn-area estimation failed")
        raise HTTPException(status_code=503, detail="Burn-area processing unavailable") from None