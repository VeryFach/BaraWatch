# Configuration reference

Never copy secret values into documentation, logs, commits, screenshots or browser bundles. `.env` is ignored by Git; `.env.example` currently documents only a subset of the variables below. Compose `env_file` injects environment values into the container. Pydantic Settings reads `.env` for its declared settings, but other modules use `os.getenv`; for local commands, export those values into the process environment. Do not print `.env` while diagnosing.

## Application settings

| Variable | Required/default | Consumer | Sensitive |
|---|---|---|---|
| `APP_NAME` | Optional; `BaraWatch AI` | Pydantic settings, `/health` | No |
| `APP_VERSION` | Optional; `0.2.0` | Pydantic settings, `/health` | No |
| `APP_ENV` | Optional; `development`; allowed `development`, `test`, `staging`, `production` | Settings validation and internal auth | No |
| `LOG_LEVEL` | Optional; `INFO`; standard levels | Structured logger | No |
| `AI_INTERNAL_KEY` | Optional in development; at least 32 chars required in staging/production | Internal routes | **Yes** |
| `BARAWATCH_AI_API_KEY` | Optional setting; vision endpoint returns 503 if empty | Vision route `X-API-Key` | **Yes** |
| `FIRMS_MAP_KEY` | Optional setting; required when FIRMS downloader is called | FIRMS helper/CLI | **Yes** |

## Model inference

| Variable | Default | Consumer | Sensitive |
|---|---|---|---|
| `BARAWATCH_DEVICE` | `auto` (Docker Compose sets `cpu`) | YOLO device selection | No |
| `MFRAZON_MODEL_PATH` | `models/weights/fire_smoke_yolov8.pt` | Detector | No; filesystem path |
| `TOUATI_MODEL_PATH` | `models/weights/model.pt` | Detector | No; filesystem path |
| `MFRAZON_IMAGE_SIZE`, `TOUATI_IMAGE_SIZE` | `640` | Per-model `imgsz` | No |
| `MFRAZON_CONFIDENCE`, `TOUATI_CONFIDENCE` | `0.10` | Per-model confidence filter | No |
| `MFRAZON_IOU`, `TOUATI_IOU` | `0.50` | Per-model IoU filter | No |

## Copernicus and local files

| Variable | Default/required | Consumer | Sensitive |
|---|---|---|---|
| `COPERNICUS_STAC_URL` | Optional; code default is legacy `https://catalogue.dataspace.copernicus.eu/stac`; must exactly match an allowlisted CDSE host | STAC query | No |
| `CDSE_S3_ACCESS_KEY` | Required for raster access | boto3/rasterio | **Yes** |
| `CDSE_S3_SECRET_KEY` | Required for raster access | boto3/rasterio | **Yes** |
| `BURN_AREA_CACHE_DIR` | `/tmp/barawatch-burn-area-cache` | JP2 local cache | No; filesystem path |
| `BURN_AREA_OUTPUT_DIR` | `outputs/burn_area` | Optional GeoTIFF output | No; filesystem path |
| `BARAWATCH_PORT` | `8000` | Compose host port interpolation | No |
| `HF_HOME` | `/opt/huggingface` in image | Container environment/cache volume; current detector uses local checkpoints | No; filesystem path |
| `PYTHONDONTWRITEBYTECODE` | `1` in Docker image | Python bytecode file behavior | No |
| `PYTHONUNBUFFERED` | `1` in Docker image | Immediate stdout/stderr output for container logs | No |

`COPERNICUS_STAC_URL` should be checked against the [current CDSE STAC documentation](https://documentation.dataspace.copernicus.eu/APIs/STAC.html); the code's default is documented as deprecated there. `CDSE_S3_*` and `BURN_AREA_*` variables are not listed in the current `.env.example`.

## Safe setup and rotation

1. Copy `.env.example` to `.env` and set values locally; `.env` is ignored by Git.
2. Generate an internal key with a cryptographically secure generator, for example `python -c 'import secrets; print(secrets.token_urlsafe(32))'`. A 32-byte random token normally exceeds the configured 32-character minimum.
3. Keep `AI_INTERNAL_KEY`, `BARAWATCH_AI_API_KEY`, `FIRMS_MAP_KEY` and CDSE S3 credentials separate. Send `X-Internal-Key`/`X-API-Key` only from trusted server-side clients.
4. For rotation, issue a new provider key where applicable, update the deployment secret store and authorized server-side caller together, restart/redeploy through the approved deployment process, then revoke the old key. Do not rotate automatically as a documentation step.
5. For local process variables read by `os.getenv`, ensure the launching process receives them. Docker Compose `env_file` does this for container processes. Pydantic loading a value from `.env` does not make it available to `os.getenv`.
