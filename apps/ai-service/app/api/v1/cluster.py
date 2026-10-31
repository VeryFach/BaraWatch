from fastapi import APIRouter, Depends, HTTPException

from app.core.security import require_internal_key
from app.schemas.clustering import (
    ClusterRequest,
    ClusterResponse,
)
from app.services.clustering.dbscan import cluster_hotspots

router = APIRouter(
    prefix="/v1",
    tags=["Hotspot Intelligence"],
    dependencies=[Depends(require_internal_key)],
)


@router.post(
    "/cluster",
    response_model=ClusterResponse,
)
def cluster(payload: ClusterRequest):
    try:
        result = cluster_hotspots(payload)
        return result

    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc
        