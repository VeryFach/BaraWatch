
import secrets
from io import BytesIO

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    UploadFile,
)
from PIL import Image, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.services.vision.detector import predict_vision
from app.services.vision.fusion import fuse_predictions

router = APIRouter(
    prefix="/v1/vision",
    tags=["Vision"],
)

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS


@router.post("/detect")
async def detect_image(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(
        default=None,
        alias="X-API-Key",
    ),
    settings: Settings = Depends(get_settings),
):
    expected_key = settings.vision_api_key

    if not expected_key:
        raise HTTPException(
            status_code=503,
            detail="AI API key belum dikonfigurasi",
        )

    if (
        not x_api_key
        or not secrets.compare_digest(
            x_api_key,
            expected_key,
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized",
        )

    if file.content_type not in {
        "image/jpeg",
        "image/png",
    }:
        raise HTTPException(
            status_code=415,
            detail="Gunakan gambar JPG atau PNG",
        )

    try:
        content = await file.read(
            MAX_FILE_SIZE + 1
        )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Ukuran gambar maksimal 10 MB",
            )

        with Image.open(BytesIO(content)) as source:
            if source.format not in {
                "JPEG",
                "PNG",
            }:
                raise HTTPException(
                    status_code=415,
                    detail="Format gambar tidak valid",
                )

            source.load()

            image_width, image_height = source.size

            if (
                source.width * source.height
                > MAX_IMAGE_PIXELS
            ):
                raise HTTPException(
                    status_code=413,
                    detail="Resolusi gambar terlalu besar",
                )

            image = source.convert("RGB")

    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="File gambar rusak atau tidak valid",
        )

    try:
        predictions = await run_in_threadpool(predict_vision, image)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Vision model checkpoint is not provisioned",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail="Vision inference is unavailable",
        ) from exc

    fusion = fuse_predictions(
        predictions["models"]["mfranzon"],
        predictions["models"]["touati"],
    )

    return {
        "status": "success",
        "filename": file.filename,
        "device": predictions["device"],
        "image_size": {
            "width": image_width,
            "height": image_height,
        },
        "vision": fusion,
        "model_results": predictions["models"],
    }
