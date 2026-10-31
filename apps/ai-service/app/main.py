import logging
import time
import uuid

from fastapi import FastAPI, Request

from app.api.health import router as health_router
from app.api.v1.cluster import router as cluster_router
from app.api.v1.system import router as system_router
from app.api.v1.vision import router as vision_router
from app.core.config import get_settings
from app.core.logging import setup_logging


def create_app() -> FastAPI:

    settings = get_settings()

    setup_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="BaraWatch AI - Hotspot Intelligence",
    )

    @app.middleware("http")
    async def request_logging(
        request: Request,
        call_next,
    ):

        start = time.perf_counter()
        request_id = str(uuid.uuid4())

        response = await call_next(request)

        duration_ms = round(
            (time.perf_counter() - start) * 1000,
            2,
        )

        response.headers["X-Request-ID"] = request_id

        logging.getLogger("barawatch").info(
            "request completed",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            },
        )

        return response

    app.include_router(health_router)
    app.include_router(system_router)
    app.include_router(cluster_router)
    app.include_router(vision_router)

    return app


app = create_app()