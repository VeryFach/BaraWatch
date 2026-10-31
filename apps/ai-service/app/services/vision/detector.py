import os
import platform
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image

MODEL_CONFIGS = {
    "mfranzon": {
        "path_env": "MFRAZON_MODEL_PATH",
        "default_path": "models/weights/fire_smoke_yolov8.pt",
        "imgsz_env": "MFRAZON_IMAGE_SIZE",
        "conf_env": "MFRAZON_CONFIDENCE",
        "iou_env": "MFRAZON_IOU",
    },
    "touati": {
        "path_env": "TOUATI_MODEL_PATH",
        "default_path": "models/weights/model.pt",
        "imgsz_env": "TOUATI_IMAGE_SIZE",
        "conf_env": "TOUATI_CONFIDENCE",
        "iou_env": "TOUATI_IOU",
    },
}


def select_device(requested: str | None = None) -> str:
    requested = requested or os.getenv("BARAWATCH_DEVICE", "auto")
    if requested != "auto":
        return requested

    import torch

    if torch.cuda.is_available():
        return "cuda"
    if platform.system() == "Darwin" and torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    return default if value is None else float(value)


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    return default if value is None else int(value)


@lru_cache(maxsize=3)
def _load_model(model_name: str, path: str):
    from ultralytics import YOLO

    model_path = Path(path)
    if not model_path.is_file():
        raise FileNotFoundError(
            f"{model_name} model checkpoint not found: {model_path}"
        )
    return YOLO(str(model_path))


def _model_path(model_name: str) -> str:
    config = MODEL_CONFIGS[model_name]
    return os.getenv(config["path_env"], config["default_path"])


def _serialize_result(result: Any) -> list[dict[str, Any]]:
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return []

    names = getattr(result, "names", {}) or {}
    detections = []
    for index, class_id in enumerate(boxes.cls.tolist()):
        class_id = int(class_id)
        xyxy = [round(float(value), 2) for value in boxes.xyxy[index].tolist()]
        detections.append(
            {
                "class": str(names.get(class_id, class_id)),
                "confidence": round(float(boxes.conf[index]), 6),
                "bbox": xyxy,
            }
        )
    return detections


def predict_vision(image: Image.Image, device: str | None = None) -> dict[str, Any]:
    selected_device = select_device(device)
    models = {}
    for model_name, config in MODEL_CONFIGS.items():
        model = _load_model(model_name, _model_path(model_name))
        results = model.predict(
            source=image,
            imgsz=_int_env(config["imgsz_env"], 640),
            conf=_float_env(config["conf_env"], 0.10),
            iou=_float_env(config["iou_env"], 0.50),
            device=selected_device,
            verbose=False,
        )
        result = results[0]
        models[model_name] = _serialize_result(result)

    return {"device": selected_device, "models": models}
