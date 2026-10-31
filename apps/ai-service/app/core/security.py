
import hmac

from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


def require_internal_key(
    x_internal_key: str | None = Header(default=None, alias="X-Internal-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    """Pasang sebagai dependency pada endpoint /v1 yang membutuhkan autentikasi.

    Dalam development tanpa key, akses lokal diperbolehkan untuk kemudahan eksperimen.
    Jangan expose server development secara publik.
    """
    expected = settings.ai_internal_key
    if expected and (x_internal_key is None or not hmac.compare_digest(x_internal_key, expected)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if not expected and settings.app_env != "development":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Key not configured")