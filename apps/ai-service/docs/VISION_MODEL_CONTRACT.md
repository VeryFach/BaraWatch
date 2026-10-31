# Vision model contract

## Models and native classes

The intended checkpoints are:

1. `mfranzon/fire-smoke-yolov8`, checkpoint `fire_smoke_yolov8.pt`, with
   `fire` and `smoke`.
2. `touati-kamel/yolov8s-forest-fire-detection`, checkpoint `model.pt`, with
   `fire-smoke`, `fog`, `sol`, `fire`, and `factory-smoke`.

Checkpoint files and immutable revision hashes must be selected and verified
during deployment provisioning; they are not committed here.

## Mapping and fusion

The target labels are `fire`, `wildfire_smoke`, and `industrial_smoke`.

- Mfranzon `fire` contributes fire evidence.
- Mfranzon `smoke` contributes general smoke evidence.
- Touati `fire-smoke` maps to wildfire-smoke evidence.
- Touati `factory-smoke` maps to industrial-smoke evidence.
- Touati `fog` is a confounder and is never fire.
- Touati `sol` is preserved in native detections and is not mapped.

Fire and smoke labels may coexist. Both smoke-origin classes produce
`smoke_type: ambiguous` and `needs_review: true`. General smoke alone produces
`smoke_unknown`; no detection produces `not_detected`. Thresholds are
provisional operating points, not calibrated probabilities. Per-model object
confidence and IoU thresholds are environment-configurable; the fusion label
thresholds are fixed at 0.25 in `services/vision/fusion.py`.

## Response shape

`POST /v1/vision/detect` returns `status`, `filename`, `device`, `image_size`,
`vision`, and `model_results`. The `image_size` object contains decoded image
width and height. The `vision` object contains `labels`, `smoke_type`, `scores`,
and `needs_review`; `model_results` retains each model's native class,
confidence, and `[x1, y1, x2, y2]` pixel-coordinate box.

Image-only classification is tentative. It must not be presented as officially
verified smoke origin without contextual evidence.
