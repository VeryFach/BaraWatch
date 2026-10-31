# Deployment

## Container

`Dockerfile` uses `python:3.11-slim`, installs CPU PyTorch and project/Copernicus dependencies, creates a non-root `serviceuser`, and starts Uvicorn on port 8000. `compose.yaml` builds this image and:

- publishes `${BARAWATCH_PORT:-8000}:8000`;
- optionally injects `.env`;
- forces `BARAWATCH_DEVICE=cpu`;
- mounts `models/weights` read-only at `/service/models/weights`;
- mounts a named Hugging Face cache volume at `/opt/huggingface`;
- runs with read-only root filesystem and `/tmp` tmpfs;
- probes only `GET /health` for container health.

There is no database container or Supabase connection. The declared `model-cache` volume in Compose is not mounted by the current service definition; actual checkpoints are mounted from the host path. Local `.pt` files are ignored by Git and are not copied into the image.

From `apps/ai-service`:

```sh
docker compose config
docker compose up --build -d
docker compose ps
docker compose logs --tail=100 barawatch-ai
curl -f http://localhost:8000/health
```

These commands require a running Docker Engine/daemon. An image build is not proof of endpoint inference or real CDSE connectivity.

## Environment and external access

Supply settings through an approved secret manager or Compose `env_file`. Do not commit `.env`. The environment variable inventory is in [Configuration](CONFIGURATION.md). Set `AI_INTERNAL_KEY`, `BARAWATCH_AI_API_KEY`, `FIRMS_MAP_KEY` only where needed, and CDSE S3 keys only when burn-area is enabled. The STAC URL should be checked against current CDSE docs; code default is a legacy endpoint described as deprecated.

## Writable paths and cache

- `/tmp/barawatch-burn-area-cache` is the default local raster cache. Compose provides `/tmp` as tmpfs, so cached downloads are ephemeral across container recreation. No size/age eviction exists within the running container.
- `BURN_AREA_OUTPUT_DIR` defaults to `outputs/burn_area`, but the Compose root filesystem is read-only and no output volume is mounted. Requests with `save_geotiff=true` can fail unless a writable path is explicitly provided/mounted by deployment configuration.
- Models must exist under the mounted weights directory. Missing weights cause vision 503.
- The `/opt/huggingface` volume is mounted, but current inference uses local checkpoint paths and does not download through Hugging Face Hub.

## Health and readiness

`GET /health` reports application settings and `active_models: {}`. It is a liveness endpoint, not a readiness check: it does not verify internal auth, checkpoints, FIRMS MAP_KEY, CDSE STAC DNS, S3 access, disk space, or raster availability. The Compose health check therefore does not establish those capabilities.

## Deployment status

The Docker configuration is CPU-first, non-root and uses a read-only filesystem. Production readiness is not established: latest Docker smoke test was blocked by daemon availability, live CDSE tests failed during STAC DNS resolution, YOLO weights are locally provisioned and unpinned, and no accuracy benchmarks/ground-truth evaluation are documented. Do not expose the development configuration publicly. Historical public-tunnel checks in an older validation report are not current deployment verification.
