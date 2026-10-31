from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings

router = APIRouter(tags=["System"])


@router.get("/health")
def health(
    settings: Settings = Depends(get_settings),
):
    return {
        "status": "ok",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.app_env,
        "active_models": {},
    }