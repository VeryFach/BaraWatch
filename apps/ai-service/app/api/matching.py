
import os
import secrets

from fastapi import APIRouter, Header, HTTPException, status

from app.schemas.matching import (
    MatchingRequest,
    MatchingResponse,
)
from app.services.matching.spatiotemporal import (
    match_report,
)

router = APIRouter(
    prefix="/v1/matching",
    tags=["Spatial-Temporal Matching"],
)


def verify_internal_key(
    x_internal_key: str | None,
) -> None:
    expected_key = os.getenv("AI_INTERNAL_KEY")

    # Fail closed if the service is misconfigured.
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Internal authentication is not configured",
        )

    if (
        not x_internal_key
        or not secrets.compare_digest(
            x_internal_key, expected_key
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )


@router.post(
    "/score",
    response_model=MatchingResponse,
)
def score_matching(
    payload: MatchingRequest,
    x_internal_key: str | None = Header(
        default=None,
        alias="X-Internal-Key",
    ),
) -> MatchingResponse:
    verify_internal_key(x_internal_key)
    return match_report(payload)
