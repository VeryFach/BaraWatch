from fastapi import APIRouter, Header

from app.api.v1.matching import verify_internal_key
from app.schemas.risk import RiskRequest, RiskResponse
from app.services.risk.rule_based import calculate_risk

router = APIRouter(
    prefix="/v1/risk",
    tags=["Risk Scoring"],
)


@router.post("/score", response_model=RiskResponse)
def score_risk(
    payload: RiskRequest,
    x_internal_key: str | None = Header(
        default=None,
        alias="X-Internal-Key",
    ),
) -> RiskResponse:
    verify_internal_key(x_internal_key)
    return calculate_risk(payload)