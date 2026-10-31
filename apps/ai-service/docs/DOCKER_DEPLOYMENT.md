# Docker deployment

## Requirements

Docker Engine with Compose v2 is required. The default image is Linux,
Python 3.11, CPU-first, and runs as the non-root `serviceuser`.

## Build and start

```sh
docker compose config
docker compose build
cp .env.example .env
docker compose up -d
docker compose ps
docker compose logs --tail=100
curl -f http://localhost:8000/health
```

The host port is configurable with `BARAWATCH_PORT` and defaults to `8000`.
There is no database container: this service is stateless and does not write
Supabase.

## Configuration

Set `AI_INTERNAL_KEY` for internal routes and `BARAWATCH_AI_API_KEY` for the
vision upload route. Use strong values in staging/production and never commit
`.env`. `BARAWATCH_DEVICE=cpu` is forced by Compose because Apple MPS is not
available inside a Linux Docker container.

## Model provisioning

The image intentionally does not download or redistribute model weights.
Provide the trusted checkpoints in the `model-cache` volume (or set the model
path variables to mounted files):

- `MFRAZON_MODEL_PATH`: `fire_smoke_yolov8.pt`
- `TOUATI_MODEL_PATH`: `model.pt`

The detector loads each checkpoint once per process and uses `HF_HOME` for any
future Hugging Face cache integration. Requests made before provisioning return
503 rather than silently pretending that no objects were detected.

## Health and troubleshooting

The health check only calls `GET /health`; it does not run inference. Inspect
startup and request failures with `docker compose logs --tail=100`.
Restart with `docker compose restart`. A 503 from vision usually means a
checkpoint is missing or model initialization failed.

Native macOS processes may select MPS automatically when available. Docker
always uses CPU; confidence values need not be bit-identical across devices.
