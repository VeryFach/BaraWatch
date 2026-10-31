
import json
import math
import secrets
from io import BytesIO
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    File,
    Header,
    HTTPException,
    Query,
    Response,
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

MODEL_COLORS = {
    "mfranzon": (0, 102, 255),
    "touati": (255, 128, 0),
}

ANNOTATION_VIEWS = {
    "combined": ("mfranzon", "touati"),
    "mfranzon": ("mfranzon",),
    "touati": ("touati",),
}


async def _detect(file: UploadFile, x_api_key: str | None, settings: Settings):
    """Validate and infer once; shared by JSON and annotated image responses."""
    expected_key = settings.vision_api_key

    if not expected_key:
        raise HTTPException(status_code=503, detail="AI API key belum dikonfigurasi")

    if not x_api_key or not secrets.compare_digest(x_api_key, expected_key):
        raise HTTPException(status_code=401, detail="Unauthorized")

    if file.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=415, detail="Gunakan gambar JPG atau PNG")

    try:
        content = await file.read(MAX_FILE_SIZE + 1)
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413, detail="Ukuran gambar maksimal 10 MB")

        with Image.open(BytesIO(content)) as source:
            if source.format not in {"JPEG", "PNG"}:
                raise HTTPException(status_code=415, detail="Format gambar tidak valid")
            source.load()
            image_width, image_height = source.size
            if source.width * source.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=413, detail="Resolusi gambar terlalu besar")
            image = source.convert("RGB")
            image_format = source.format
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(status_code=400, detail="File gambar rusak atau tidak valid")

    try:
        predictions = await run_in_threadpool(predict_vision, image)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Vision model checkpoint is not provisioned",
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="Vision inference is unavailable") from exc

    fusion = fuse_predictions(
        predictions["models"]["mfranzon"], predictions["models"]["touati"]
    )
    result = {
        "status": "success",
        "filename": file.filename,
        "device": predictions["device"],
        "image_size": {"width": image_width, "height": image_height},
        "vision": fusion,
        "model_results": predictions["models"],
    }
    return image, image_format, result


def _load_annotation_font(size: int):
    """Prefer Pillow's scalable bundled font and fall back to its default font."""
    from PIL import ImageFont

    try:
        return ImageFont.load_default(size=size)
    except (OSError, TypeError):
        return ImageFont.load_default()


def _label_position(
    image_size: tuple[int, int],
    anchor: tuple[float, float],
    label_size: tuple[int, int],
    padding: int,
) -> tuple[int, int]:
    width, height = image_size
    label_width, label_height = label_size
    label_x = min(max(2, round(anchor[0])), max(2, width - label_width - padding * 2))
    label_y = round(anchor[1]) - label_height - padding * 2 - 2
    if label_y < 2:
        label_y = round(anchor[1]) + 2
    if label_y + label_height + padding * 2 > height - 2:
        label_y = max(2, height - label_height - padding * 2 - 2)
    return label_x, label_y


def _format_detection_label(detection: dict) -> str | None:
    class_name = str(detection.get("class", "object")).replace("_", " ").title()
    if class_name == "Factory-Smoke":
        class_name = "Factory Smoke"
    try:
        confidence = float(detection.get("confidence"))
    except (TypeError, ValueError):
        return f"{class_name} n/a"
    if not math.isfinite(confidence):
        return None
    return f"{class_name} {confidence:.1%}"


def _fit_annotation_label(draw, label: str, preferred_size: int, max_width: int):
    for size in range(preferred_size, 7, -1):
        font = _load_annotation_font(size)
        bounds = draw.textbbox((0, 0), label, font=font)
        if bounds[2] - bounds[0] <= max_width:
            return label, font, bounds

    font = _load_annotation_font(8)
    while True:
        bounds = draw.textbbox((0, 0), label, font=font)
        if bounds[2] - bounds[0] <= max_width:
            return label, font, bounds
        if label == "…":
            return label, font, bounds
        label = label[:-2].rstrip()
        if label:
            label += "…"
        else:
            label = "…"


def render_detections(
    image: Image.Image,
    model_results: dict,
    view: Literal["combined", "mfranzon", "touati"] = "combined",
) -> Image.Image:
    """Draw native model boxes only; aggregate fusion scores never create boxes."""
    from PIL import ImageDraw

    annotated = image.copy().convert("RGB")
    draw = ImageDraw.Draw(annotated)
    width, height = annotated.size
    line_width = max(3, round(min(width, height) / 250))
    font_size = max(12, min(32, round(min(width / 30, height / 3))))
    padding = max(3, round(font_size / 5))

    for model_name in ANNOTATION_VIEWS[view]:
        detections = model_results.get(model_name, [])
        color = MODEL_COLORS.get(model_name, (0, 200, 80))
        for detection in detections:
            bbox = detection.get("bbox")
            if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
                continue
            try:
                x1, y1, x2, y2 = (float(value) for value in bbox)
            except (TypeError, ValueError):
                continue
            if not all(math.isfinite(value) for value in (x1, y1, x2, y2)):
                continue
            x1, x2 = max(0, min(width - 1, x1)), max(0, min(width - 1, x2))
            y1, y2 = max(0, min(height - 1, y1)), max(0, min(height - 1, y2))
            if x2 <= x1 or y2 <= y1:
                continue
            draw.rectangle((x1, y1, x2, y2), outline=color, width=line_width)
            label = _format_detection_label(detection)
            if label is None:
                continue
            label, font, text_bounds = _fit_annotation_label(
                draw, label, font_size, max(1, width - 4 - padding * 2)
            )
            label_size = (text_bounds[2] - text_bounds[0], text_bounds[3] - text_bounds[1])
            label_x, label_y = _label_position(
                annotated.size, (x1, y1), label_size, padding
            )
            background = (
                label_x,
                label_y,
                label_x + label_size[0] + padding * 2,
                label_y + label_size[1] + padding * 2,
            )
            draw.rectangle(background, fill=color)
            draw.text(
                (label_x + padding - text_bounds[0], label_y + padding - text_bounds[1]),
                label,
                fill=(255, 255, 255),
                font=font,
            )
    return annotated


@router.post("/detect")
async def detect_image(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(
        default=None,
        alias="X-API-Key",
    ),
    settings: Settings = Depends(get_settings),
):
    _, _, result = await _detect(file, x_api_key, settings)
    return result


@router.post(
    "/detect/annotated",
    response_class=Response,
    responses={
        200: {
            "description": "JPEG or PNG image with native YOLO detections annotated",
            "content": {"image/jpeg": {}, "image/png": {}},
        }
    },
)
async def detect_annotated_image(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    view: Literal["combined", "mfranzon", "touati"] = Query(default="combined"),
    settings: Settings = Depends(get_settings),
):
    image, image_format, result = await _detect(file, x_api_key, settings)
    annotated = render_detections(image, result["model_results"], view=view)
    output = BytesIO()
    save_options = {"quality": 95, "subsampling": 0} if image_format == "JPEG" else {}
    annotated.save(output, format=image_format, **save_options)
    media_type = "image/jpeg" if image_format == "JPEG" else "image/png"
    vision_summary = json.dumps(result["vision"], separators=(",", ":"))
    return Response(
        content=output.getvalue(),
        media_type=media_type,
        headers={"X-Vision-Summary": vision_summary},
    )
