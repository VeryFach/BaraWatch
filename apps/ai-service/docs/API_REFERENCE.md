# API reference

Base URL depends on how the service is run (local default `http://127.0.0.1:8000`). The routes below are registered in `app/main.py`; the same route list is generated at `/openapi.json`. JSON examples and success payloads below are **illustrative**, not observed output, unless explicitly stated. The vision upload uses multipart form data.

Protected route auth is described per operation. Do not send keys from browser code. See [Security](SECURITY.md) and [Configuration](CONFIGURATION.md).

## `GET /health`

Unauthenticated liveness response; does not test model readiness or third-party connectivity.

**Success `200`:** `status` (`ok`), `service`, `version`, `environment`, `active_models` (currently empty object).

Illustrative response:

```json
{"status":"ok","service":"BaraWatch AI","version":"0.2.0","environment":"development","active_models":{}}
```

Source: `app/api/health.py`, `app/schemas/health.py`.

## `GET /v1/ping`

Internal service ping. Header: `X-Internal-Key`. In development, `require_internal_key` permits access when no key is configured; never expose that configuration publicly. With a configured key, missing or incorrect value returns `401`. Staging/production settings require a key of at least 32 characters.

**Success `200`:** `status`, `message`. Other responses: `401` unauthorized; `503` when auth is unconfigured outside development (normally startup validation prevents this for staging/production).

Illustrative response:

```json
{"status":"ok","message":"BaraWatch AI internal service running"}
```

Source: `app/api/v1/system.py`, `app/core/security.py`.

## `POST /v1/cluster`

Cluster supplied hotspot records. Header: `X-Internal-Key`; same dependency behavior as `/v1/ping`.

Request object:

- `hotspots`: optional array, max 20,000. Each has required nonempty `id` (max 180), latitude `[-90,90]`, longitude `[-180,180]`, timezone-aware `acq_at`; optional `satellite`, `instrument`, `confidence_raw`, `frp >= 0`; `confidence_level` is `low|nominal|high|unknown` (default `unknown`).
- `open_incidents`: optional array, max 1,000; each has nonempty `id`, valid lat/lon and optional `last_detected_at`.
- `eps_km`: `(0,100]`, default 1.5. `min_samples`: `[1,100]`, default 2.
- `max_time_gap_hours`: `(0,168]`, default 24. `match_radius_km`: `(0,100]`, default 1.5.
- `minimum_confidence`: `all|nominal|high`, default `nominal`.

Illustrative request:

```json
{
  "hotspots": [
    {"id":"h-001","latitude":-2.21,"longitude":113.92,"acq_at":"2026-07-10T02:00:00Z","confidence_level":"high","frp":4.2},
    {"id":"h-002","latitude":-2.211,"longitude":113.921,"acq_at":"2026-07-10T02:20:00Z","confidence_level":"nominal","frp":3.1}
  ],
  "eps_km": 1.5,
  "min_samples": 2,
  "minimum_confidence":"nominal"
}
```

**Success `200`:** `clusters` (IDs, member IDs/count, centroid, optional GeoJSON-like footprint, first/last timestamps, matched incident ID), `noise_hotspot_ids`, `filtered_hotspot_ids`, `algorithm`, `input_count`. Duplicate hotspot IDs are a service `ValueError` mapped to `422`; schema validation errors also return `422`; auth failures `401`/`503`.

Illustrative response:

```json
{"clusters":[{"cluster_id":"cluster-0","hotspot_ids":["h-001","h-002"],"hotspot_count":2,"centroid":{"latitude":-2.2105,"longitude":113.9205},"footprint":null,"first_detected_at":"2026-07-10T02:00:00Z","last_detected_at":"2026-07-10T02:20:00Z","matched_incident_id":null}],"noise_hotspot_ids":[],"filtered_hotspot_ids":[],"algorithm":"dbscan-haversine-v1","input_count":2}
```

Source: `app/api/v1/cluster.py`, `app/schemas/clustering.py`.

## `POST /v1/vision/detect`

Run both configured YOLO models and fuse category evidence. Header: `X-API-Key`. Body is `multipart/form-data` field `file`; accepted MIME and decoded formats are JPEG and PNG. Maximum file size is 10 MiB and maximum image area is 20 million pixels.

Example request (replace the placeholder with a server-side key and a local image path):

```sh
curl -X POST http://127.0.0.1:8000/v1/vision/detect \
  -H 'X-API-Key: <server-side-key>' \
  -F 'file=@./sample.jpg;type=image/jpeg'
```

**Success `200`:** `status`, `filename`, `device`, `image_size` (`width`,`height`), `vision` (`labels`, `smoke_type`, `scores`, `needs_review`) and `model_results` keyed by `mfranzon` and `touati`. Each native detection has `class`, `confidence`, and `bbox` `[x1,y1,x2,y2]` in decoded image pixel coordinates. The route currently has no explicit Pydantic response model.

Illustrative response:

```json
{"status":"success","filename":"sample.jpg","device":"cpu","image_size":{"width":1280,"height":720},"vision":{"labels":["fire"],"smoke_type":"wildfire_smoke","scores":{"fire":0.91,"smoke_general":0.0,"wildfire_smoke":0.82,"industrial_smoke":0.0,"fog":0.0},"needs_review":false},"model_results":{"mfranzon":[{"class":"fire","confidence":0.91,"bbox":[120.5,80.0,340.2,290.7]}],"touati":[{"class":"fire-smoke","confidence":0.82,"bbox":[100.0,60.0,360.0,310.0]}]}}
```

Errors: `400` corrupt/invalid image; `401` missing/wrong key; `413` size or pixel limit exceeded; `415` unsupported media/format; `503` key not configured, checkpoint missing, or caught inference runtime error. Pydantic is not used for upload validation; checks are in the route.

Source: `app/api/v1/vision.py`, `app/services/vision/detector.py`, `app/services/vision/fusion.py`.

## `POST /v1/matching/score`

Score a report against candidate satellite hotspots. Header: `X-Internal-Key`; missing configured key produces `503`, wrong/missing request key produces `401`.

Request requires `report` with latitude/longitude, timezone-aware `observed_at`, and `vision` fields (`fire`, `smoke_general`, `wildfire_smoke`, `industrial_smoke`, each `[0,1]`, plus optional `needs_review`). `hotspots` defaults empty, max 5,000; each needs nonempty ID (max 128), valid coordinate, timezone-aware `acq_at`. `radius_km` `(0,50]`, default 5; `time_window_hours` `(0,168]`, default 24; `threshold` `[0,1]`, default 0.75. Extra fields are forbidden.

Illustrative request:

```json
{"report":{"latitude":-2.21,"longitude":113.92,"observed_at":"2026-07-10T02:00:00Z","vision":{"fire":0.8,"smoke_general":0.2,"wildfire_smoke":0.1,"industrial_smoke":0.0,"needs_review":false}},"hotspots":[{"hotspot_id":"h-001","latitude":-2.21,"longitude":113.92,"acq_at":"2026-07-10T02:00:00Z"}],"radius_km":5,"time_window_hours":24,"threshold":0.75}
```

**Success `200`:** status, algorithm, decision (`auto_pass|uncertain|rejected` schema enum; implementation currently emits only `auto_pass` or `uncertain`), verification score, review flag, optional matched candidate details, candidate count and reasons. Validation errors `422`; auth errors `401` or `503`.

Illustrative response:

```json
{"status":"success","algorithm":"spatiotemporal-rule-v1","decision":"auto_pass","verification_score":0.92,"needs_review":false,"matched_hotspot":{"hotspot_id":"h-001","distance_m":0.0,"time_difference_minutes":0.0,"spatial_score":1.0,"temporal_score":1.0,"combined_score":0.92},"candidates_within_window":1,"reasons":["satellite_candidate_found","positive_visual_evidence","automatic_screening_passed"]}
```

Source: `app/api/v1/matching.py`, `app/schemas/matching.py`.

## `POST /v1/hotspots/filter`

Apply quality-review rules. Header: `X-Internal-Key`; missing configured key returns `503`, invalid/missing key returns `401`.

Request requires `hotspots` array (max 5,000). Each record needs nonempty `hotspot_id`, valid latitude/longitude, `confidence` `l|n|h`, `daynight` `D|N`; optional nonnegative `frp`, satellite, and acquisition time string. Optional `known_heat_sources` max 500 with ID, coordinate and radius `(0,100]`. Optional config defaults to review low confidence and missing FRP; experimental FRP threshold is nullable and nonnegative. Extra fields forbidden.

Illustrative request:

```json
{"hotspots":[{"hotspot_id":"h-001","latitude":-2.21,"longitude":113.92,"confidence":"n","frp":4.2,"daynight":"D","satellite":"N20","acq_at":"2026-07-10 0200"}],"known_heat_sources":[],"config":{"review_low_confidence":true,"review_missing_frp":true}}
```

**Success `200`:** status, algorithm, summary counts and reason counts, plus per-hotspot decision/reasons/source match. `review` is not equivalent to false positive. Validation errors `422`; auth errors `401`/`503`.

Illustrative response:

```json
{"status":"success","algorithm":"hotspot-quality-v1","summary":{"total":1,"eligible":1,"review":0,"by_reason":{}},"results":[{"hotspot_id":"h-001","decision":"eligible","reasons":[],"matched_heat_source_id":null}]}
```

Source: `app/api/v1/hotspot_filter.py`, `app/schemas/hotspot_filter.py`.

## `POST /v1/risk/score`

Calculate heuristic activity score from aggregate counts. Header: `X-Internal-Key`; missing configured key returns `503`, invalid/missing key returns `401`.

Required: nonempty `region_id` (max 128), nonnegative `hotspot_count`, `eligible_count`, and `review_count`; eligible plus review must equal total. `window_hours` `(0,720]`, default 120. Optional `frp_max_mw` and `frp_mean_mw` must be nonnegative; mean cannot exceed max; FRP values must be null if count is zero. Extra fields forbidden.

Illustrative request:

```json
{"region_id":"central-kalimantan","window_hours":120,"hotspot_count":10,"eligible_count":8,"review_count":2,"frp_max_mw":9.0,"frp_mean_mw":5.0}
```

**Success `200`:** status, algorithm, region, nullable score, level (`low|moderate|high|insufficient_data`), component scores, reasons, limitations. This is not probability. Schema errors `422`; auth errors `401`/`503`.

Illustrative response:

```json
{"status":"success","algorithm":"hotspot-activity-index-v1","region_id":"central-kalimantan","risk_score":28.5,"risk_level":"low","components":{"activity":0.1,"eligible_ratio":0.8,"frp":0.25},"reasons":["low_hotspot_activity"],"limitations":["Heuristic hotspot activity index, not calibrated fire probability","No weather, peatland, land-cover, or historical fire labels","Satellite non-detection does not establish absence of fire"]}
```

Source: `app/api/v1/risk.py`, `app/schemas/risk.py`.

## `POST /v1/burn-area/estimate`

Search/process Sentinel-2 L2A imagery. Header: `X-Internal-Key`; missing configured key returns `503`, invalid/missing key returns `401`.

Request is strict (extra fields forbidden): latitude `[-90,90]`, longitude `[-180,180]`, `radius_km` `(0,5]` default 2, pre/post start/end dates, `dnbr_threshold` `[-1,1]` default 0.10, `max_cloud_percent` `[0,100]` default 60, `max_scenes_per_period` `[1,5]` default 3, `save_geotiff` default false. Dates must satisfy `pre_start < pre_end <= post_start < post_end`; each period may be at most 90 days. Processing supports UTM latitudes from -80 through 84.

Illustrative request:

```json
{"latitude":-2.21,"longitude":113.92,"radius_km":2,"pre_start":"2026-07-01","pre_end":"2026-07-16","post_start":"2026-08-01","post_end":"2026-08-16","dnbr_threshold":0.1,"max_cloud_percent":60,"max_scenes_per_period":3,"save_geotiff":false}
```

**Success `200`:** status, algorithm/provider, indicated/valid/analysis area hectares, common valid coverage percent, usable scene counts and IDs, threshold, quality, optional raster path, limitations.

Illustrative response (values are examples, not an observed computation):

```json
{"status":"success","algorithm":"copernicus-sentinel2-dnbr-v1","provider":"copernicus-data-space","indicated_area_ha":1.24,"valid_area_ha":9.8,"analysis_area_ha":12.4,"valid_coverage_percent":79.03,"pre_image_count":1,"post_image_count":1,"pre_scene_ids":["example-pre-scene-1"],"post_scene_ids":["example-post-scene-1"],"dnbr_threshold":0.1,"quality":"adequate","raster_path":null,"limitations":["Spectral-change indication only; not verified burned area"]}
```

Errors to distinguish: `422` Pydantic request/date/coordinate validation; `422` valid request but no usable scene/pixels (`No usable imagery for this request`); `503` upstream STAC/S3 or other processing exception (public detail is `Burn-area processing unavailable`; underlying trace is logged). Auth errors `401`/`503`.

Source: `app/api/v1/burn_area.py`, `app/schemas/burn_area.py`, `app/services/burn_area/`.

## Status code summary

| Code | Meaning |
|---|---|
| `200` | Handler completed successfully |
| `400` | Invalid/corrupt vision image |
| `401` | Missing or incorrect configured API key |
| `413` | Vision image too large or too many pixels |
| `415` | Unsupported vision media or image format |
| `422` | Request schema/service validation, or burn-area request with no usable imagery |
| `503` | Required key/model/upstream/processing unavailable, according to route |

FastAPI may also produce its standard validation response body for `422`; burn-area imagery errors use a `detail` string. Do not treat the two causes as interchangeable.
