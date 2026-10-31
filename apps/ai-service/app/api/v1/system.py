from fastapi import APIRouter, Depends

from app.core.security import require_internal_key

router = APIRouter(prefix="/v1", tags=["internal"], dependencies=[Depends(require_internal_key)])


@router.get("/ping")
def ping() -> dict[str, str]:
    """Contoh endpoint internal untuk menguji autentikasi sebelum modul AI hadir."""
    return {"message": "pong"}