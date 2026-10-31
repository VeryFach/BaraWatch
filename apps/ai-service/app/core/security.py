import hmac

from fastapi import Depends, Header, HTTPException

from app.core.config import Settings, get_settings


def require_internal_key(
    x_internal_key: str | None = Header(
        default=None,
        alias="X-Internal-Key",
    ),
    settings: Settings = Depends(get_settings),
) -> None:

    expected = settings.ai_internal_key

    if not expected:
        if settings.app_env == "development":
            return

        raise HTTPException(
            status_code=503,
            detail="Internal API key not configured",
        )

    if x_internal_key is None or not hmac.compare_digest(
        x_internal_key, expected
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )