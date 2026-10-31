# Testing and verification

## Commands

Run from `apps/ai-service`:

```sh
./.venv/bin/python -m pytest -q
./.venv/bin/python -m ruff check app tests
./.venv/bin/python -m compileall -q app tests experiments
```

On 31 October 2026, the current suite ran **74 passed, 0 failed, 0 skipped** in 0.14 seconds with two warnings: Starlette's `TestClient`/httpx deprecation and Rasterio transform pending deprecation. Ruff and compileall passed earlier in the same documentation audit. These are local code checks, not a Docker test or model accuracy benchmark.

## What tests cover

- FIRMS CSV parsing and deterministic hotspot IDs: `tests/test_clustering.py`.
- Clustering decisions, DBSCAN boundaries, confidence filters, incidents and schema input: `tests/test_clustering.py`.
- Hotspot filter rules and route auth: `tests/test_hotspot_filter.py`.
- Matching spatial/time scoring, edge cases and route auth: `tests/test_matching.py`.
- Risk score constraints and route auth: `tests/test_risk.py`.
- dNBR arithmetic, request validation and a mocked burn-area API call: `tests/test_burn_area.py`.
- STAC asset aliases, S3 path checks, cloud sorting: `tests/test_copernicus_client.py`.
- UTM grid, SCL masking, NBR arrays and median composite: `tests/test_raster_processor.py`.
- Vision fusion and a mocked upload/prediction path: `tests/unit/test_fusion.py`, `tests/integration/test_api.py`.
- Settings validation and JSON logging: `tests/unit/`.

## Test categories and boundaries

| Category | Present evidence | What it does not prove |
|---|---|---|
| Unit tests | 74 total local tests include pure service/schema/helper checks | Accuracy on independent wildfire labels |
| Mock integration/API | FastAPI TestClient, auth checks, mocked vision/burn-area paths | External provider availability or real checkpoints |
| Real-data artifacts | Existing `data/`, `experiments/`, and `outputs/` include FIRMS/model/raster artifacts | Reproducibility or current upstream availability unless freshly rerun |
| Live HTTP | Audit made three identical burn-area endpoint requests; all returned 503 on DNS connection to STAC before scene/raster processing | B12/SCL behavior after STAC succeeds |
| Docker | Not verified in the latest audit; Docker daemon connection failed | Container startup or health in this environment |

The local test suite does not call NASA FIRMS or CDSE and does not load the YOLO checkpoints for route tests. A former `docs/TEST_RESULTS.md` contains an older 18-test and Docker snapshot; retain it only as historical evidence, not as the current test count.

The four files under repository `.github/workflows/` (`ci-ai.yml`, `ci-web.yml`, `deploy-ai.yml`, `cron-ingest.yml`) are currently zero bytes. No automated CI, deployment, or scheduled ingestion behavior is configured by those files at this revision.

## Real-data test safety

Before running scripts under `experiments/`, inspect whether they access the internet, require credentials, or write into `outputs/`. Live FIRMS queries can consume MAP_KEY transactions; CDSE asset downloads consume quota and local disk; vision scripts can write image artifacts. Do not use them just to make a test suite green. Preserve outputs and note date, exact code revision, sanitized request parameters, status, scene IDs and error text.
