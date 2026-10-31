from fastapi import APIRouter, Depends

from app.core.security import require_internal_key

router = APIRouter(
    prefix="/v1",
    tags=["System"],
)


@router.get(
    "/ping",
    dependencies=[Depends(require_internal_key)],
)
def ping():
    return {
        "status": "ok",
        "message": "BaraWatch AI internal service running",
    }