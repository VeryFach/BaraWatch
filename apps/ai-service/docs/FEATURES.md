# Features and implementation status

This page describes the current source behavior, not proposed behavior. Endpoint request/response contracts are in [API Reference](API_REFERENCE.md). Tests listed are existing tests; passing tests do not validate real-world wildfire accuracy.

| Feature | Status | Entry point | Primary tests |
|---|---|---|---|
| Health and ping | Implemented; health is liveness only | `api/health.py`, `api/v1/system.py` | `tests/integration/test_api.py` |
| Hotspot clustering | Implemented; FIRMS fetch is a separate helper/CLI | `api/v1/cluster.py`, `services/clustering/dbscan.py` | `tests/test_clustering.py`, integration API tests |
| Vision detection | Implemented; local weights and API key required | `api/v1/vision.py`, `services/vision/` | `tests/unit/test_fusion.py`, integration API tests |
| Spatial-temporal matching | Implemented heuristic; caller supplies evidence | `api/v1/matching.py`, `services/matching/spatiotemporal.py` | `tests/test_matching.py` |
| Hotspot filtering | Implemented review rules; not a truth classifier | `api/v1/hotspot_filter.py`, `services/filtering/hotspot_quality.py` | `tests/test_hotspot_filter.py` |
| Risk scoring | Implemented heuristic index; not calibrated probability | `api/v1/risk.py`, `services/risk/rule_based.py` | `tests/test_risk.py` |
| Burn-area estimate | Implemented prototype; live upstream currently unverified | `api/v1/burn_area.py`, `services/burn_area/` | `tests/test_burn_area.py`, `tests/test_copernicus_client.py`, `tests/test_raster_processor.py` |

## Health and ping

`GET /health` returns status, configured service name/version/environment, and an empty `active_models` mapping. It does not load YOLO, test credentials, query FIRMS/CDSE, or check model readiness. `GET /v1/ping` returns a constant service message and uses internal-key dependency behavior. See `app/api/health.py` and `app/api/v1/system.py`.

## Hotspot clustering

`POST /v1/cluster` accepts at most 20,000 hotspot records and at most 1,000 open incidents. It rejects duplicate hotspot IDs, filters confidence according to `minimum_confidence`, sorts kept hotspots by timestamp/ID, splits them where adjacent timestamps exceed `max_time_gap_hours`, then runs scikit-learn DBSCAN with haversine distance and `eps_km / 6371.0088`. Default parameters are 1.5 km, two samples, and 24 hours. It computes arithmetic coordinate centroids, first/last times, optional convex-hull footprint for visualization, and can attach one nearest eligible open incident to each cluster. Footprints are not burn perimeters. A duplicate ID or service `ValueError` is exposed as HTTP 422. Source: `services/clustering/dbscan.py`; tests: `tests/test_clustering.py`.

FIRMS fetch/CSV parsing lives separately in `services/firms.py` and `scripts/run_hotspots.py`; the cluster endpoint itself accepts already parsed JSON and does not perform ingestion.

## Vision detection

`POST /v1/vision/detect` accepts JPEG or PNG uploads up to 10 MiB and 20 million pixels. It converts the image to RGB, then runs both Ultralytics checkpoints with configured device, image size (default 640), confidence (0.10), and IoU (0.50). Raw detections retain `class`, `confidence`, and pixel-coordinate `bbox: [x1,y1,x2,y2]`; response also contains image dimensions. The fusion layer uses fixed provisional 0.25 score thresholds for fire/smoke categories. It emits labels, smoke type, raw maximum confidence values, and review flag. Scores are model confidences, not calibrated probabilities. Missing checkpoint returns 503; other caught inference runtime failures return 503. Source: `api/v1/vision.py`, `services/vision/detector.py`, `fusion.py`; tests: `tests/unit/test_fusion.py`, `tests/integration/test_api.py`.

The endpoint can only be used for inference if both checkpoint files are provisioned at their configured paths. See [Vision Model Contract](VISION_MODEL_CONTRACT.md).

## Spatial-temporal matching

`POST /v1/matching/score` receives one report, visual evidence fields and up to 5,000 hotspot candidates. Candidates outside the radius or time window are discarded. Haversine distance and absolute timestamp difference are converted into linear scores between 0 and 1. The combined score is `0.40 × visual + 0.35 × spatial + 0.25 × temporal`; visual evidence is `max(fire, wildfire_smoke, 0.5 × smoke_general)`. The best candidate is selected with deterministic tie-breaks. Auto-pass requires a candidate, score at/above the request threshold, visual score ≥0.50, industrial smoke <0.60, and `needs_review=false`. Otherwise result is `uncertain` and needs human review. Current code does not return `rejected`, although that value exists in the response schema. Source/test: `services/matching/spatiotemporal.py`, `tests/test_matching.py`.

## Hotspot filtering

`POST /v1/hotspots/filter` marks a record for review for low VIIRS confidence, missing FRP, an explicitly enabled experimental FRP cutoff, or proximity to a configured known heat source. A match uses the first listed source within its radius. Review does not mean false positive; eligible does not mean verified wildfire. Source/test: `services/filtering/hotspot_quality.py`, `tests/test_hotspot_filter.py`.

## Risk scoring

`POST /v1/risk/score` accepts aggregated counts, a time window and optional FRP mean/max. It computes an activity component from hotspot count per day, an eligible ratio, and an optional normalized FRP component. This is a rule-based hotspot activity index and explicitly reports limitations; it is not trained, calibrated, or a wildfire probability. With zero observations, the score is `null` and level is `insufficient_data`. Source/test: `services/risk/rule_based.py`, `tests/test_risk.py`.

## Burn-area estimation

`POST /v1/burn-area/estimate` searches Sentinel-2 L2A scenes for pre/post date windows, filters cloud metadata, selects scenes deterministically, retrieves B8/B12/SCL assets, projects to a local 20 m UTM circle grid, masks non-clear SCL classes, composites NBR by median, and calculates pre-minus-post dNBR. Pixels at/above the request threshold contribute to `indicated_area_ha`; valid area and overlap coverage are reported separately. “Adequate” means at least 70% valid overlap by current code. This is a spectral-change indication, not a mapped or verified burned perimeter. Missing/unusable imagery returns HTTP 422. Upstream exceptions return HTTP 503. Source/tests: `services/burn_area/`, `tests/test_burn_area.py`, `tests/test_copernicus_client.py`, `tests/test_raster_processor.py`.
