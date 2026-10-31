# Development guide

## Layout

```text
app/api/                 FastAPI route handlers
app/core/                Settings, auth dependency and JSON logging
app/schemas/             Pydantic request/response models
app/services/            FIRMS, clustering, filtering, matching, risk, vision, burn-area logic
tests/                   Unit and mock/API tests
experiments/             Real-data and model experiments; inspect before running
scripts/                 Local command-line workflows
models/weights/          Locally provisioned, Git-ignored checkpoints
data/                    Local sample/raw inputs; some ignored
outputs/                 Local experiment artifacts; ignored
docs/                    Service documentation and historical audit records
```

## Install and run locally

Commands below assume repository root and a POSIX shell:

```sh
cd apps/ai-service
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Settings class reads declared settings from `.env`; modules using `os.getenv` need environment variables exported in the process. In Docker, Compose injects `env_file` values. For optional burn-area development dependencies install `python -m pip install -r requirements-copernicus.txt`. Real burn-area calls also need CDSE credentials. YOLO inference needs both local checkpoints and `BARAWATCH_AI_API_KEY`.

## Useful checks

```sh
./.venv/bin/python -m pytest -q
./.venv/bin/python -m ruff check app tests
./.venv/bin/python -m compileall -q app tests experiments
```

Check registered routes without making upstream calls:

```sh
./.venv/bin/python -c 'from app.main import app; print("\n".join(sorted({route.path for route in app.routes if hasattr(route, "methods")})))'
```

OpenAPI is available at `/openapi.json`, Swagger UI at `/docs`. A successful import or health response does not load model weights or verify external credentials.

## Data and experiments

- `scripts/run_hotspots.py` runs clustering over the default synthetic CSV. Add `--fetch` to make a live NASA FIRMS request; live data use a MAP_KEY and may consume provider quota.
- `experiments/` contains real model and external data scripts. Read each script before running. Burn-area scripts can access CDSE and write output files; vision experiments may write images/JSON under `outputs/`.
- Existing sample, raw data and `outputs/` are not a comprehensive independent validation set.

## Logs and debugging

The `barawatch` logger writes structured JSON to stdout, including request ID, path, status and duration. Burn-area logs include selected scene IDs and pixel/coverage counts. Do not add credentials or full key-bearing URLs to diagnostic output. For response correlation, use the `X-Request-ID` response header with deployment logs.

## Common setup mismatches

- Install `requirements-copernicus.txt` for Rasterio, PyProj and boto3; they are not in base project dependencies.
- Native model inference may choose CUDA/MPS/CPU; Docker forces CPU.
- Local `.env` values read directly by `os.getenv` must be exported; the Pydantic settings loader is not a process-wide dotenv loader.
- Compose runs read-only root filesystem; optional GeoTIFF output needs a writable output location.
- If build scripts fail, inspect `pyproject.toml`/requirements first; do not assume README-era Stage 0 instructions still describe current source.
