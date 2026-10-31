# Models and algorithms

## Hotspot CSV normalization

The FIRMS parser requires `latitude`, `longitude`, `acq_date`, and `acq_time`. It creates a stable SHA-256-derived ID from coordinates, UTC acquisition timestamp, satellite, and instrument. VIIRS `l/n/h` confidence maps to low/nominal/high. MODIS numeric confidence maps to low below 30, nominal from 30 to below 80, and high at 80 or above. Other instruments map to `unknown`. FRP is retained when present. These mappings normalize source fields; they do not verify fire on the ground.

## DBSCAN with Haversine distance

Kept hotspots are sorted and partitioned whenever the gap between adjacent timestamps exceeds `max_time_gap_hours`. For each segment, scikit-learn DBSCAN receives radians in `[latitude, longitude]`, `metric="haversine"`, and `eps = eps_km / 6371.0088`. Defaults are 1.5 km and `min_samples=2`. Confidence filter defaults to nominal-or-high. Noise is returned separately. Cluster centroid is the arithmetic mean of member latitudes/longitudes, not a geodesic centroid. A convex hull is included only for polygon-shaped clusters and is solely a visualization footprint.

## YOLO inference and fusion

The detector loads two Ultralytics models from local checkpoint paths:

| Internal name | Default file | Native classes consumed by fusion |
|---|---|---|
| `mfranzon` | `models/weights/fire_smoke_yolov8.pt` | `fire`, `smoke` |
| `touati` | `models/weights/model.pt` | `fire-smoke`, `factory-smoke`, `fog`; `sol` is retained in native output but not mapped |

`model.predict` uses original decoded RGB image, image size 640, confidence 0.10 and IoU 0.50 by default; values may be changed with environment variables. Device selection prefers CUDA, then macOS MPS, then CPU when `BARAWATCH_DEVICE=auto`; Docker pins CPU. The detector serializes `xyxy` pixel boxes rounded to 2 decimals and confidence rounded to 6 decimals.

Fusion uses maximum confidence per class, not object-level box matching. At provisional threshold 0.25: fire from Mfranzon adds `fire`; Touati `fire-smoke` adds `wildfire_smoke`; `factory-smoke` adds `industrial_smoke`; Mfranzon `smoke` alone becomes `smoke_unknown`. Simultaneous wildfire and industrial smoke evidence is `ambiguous`. `fog` is a confounder and can require review when fire or smoke is also present. These operating points are not calibrated probabilities. No verified precision/recall/F1/mAP is documented. The two checkpoint files are ignored by Git; their current hashes/revisions are not pinned in configuration.

Model source references and licensing status are listed in [Third-party Services](THIRD_PARTY_SERVICES.md) and the existing [Vision Model Contract](VISION_MODEL_CONTRACT.md).

## Spatial-temporal matching

For report visual evidence, `V = max(fire, wildfire_smoke, 0.5 × smoke_general)`. Industrial-smoke score at or above 0.60 creates a conflict; reported vision `needs_review` also prevents auto-pass. Candidate hotspots must lie within the request radius and absolute time window. Scores are:

```text
S = max(0, 1 - distance_km / radius_km)
T = max(0, 1 - time_difference_minutes / window_minutes)
C = 0.40 × V + 0.35 × S + 0.25 × T
```

The highest `C` wins; ties use shorter distance, shorter time difference, then hotspot ID. Auto-pass requires a candidate, `C >= threshold` (default 0.75), `V >= 0.50`, no industrial conflict, and `needs_review=false`. All other cases return `uncertain` and require human review. The response schema includes `rejected`, but current service code does not emit it.

## Hotspot review rules

Each record is set to `review` if any enabled rule matches: low VIIRS confidence (`l`), missing FRP, FRP below optional experimental threshold, or distance within a known heat-source radius. The first matching heat-source entry is recorded. Defaults flag low confidence and missing FRP but do not reject or review based on FRP magnitude. “Eligible” means these configured review rules did not fire; it is not a true-fire classification.

## Rule-based activity score

When `hotspot_count > 0`:

```text
A = clamp01((hotspot_count × 24 / window_hours) / 20)
E = eligible_count / hotspot_count
F = clamp01(frp_mean_mw / 20)   (only if mean FRP is supplied)
score = 100 × (0.50 A + 0.20 E + 0.30 F) / included_weight_sum
```

When FRP is absent, its 0.30 weight is omitted and remaining weights are renormalized by 0.70. Levels are low for score `<35`, moderate for `<70`, high otherwise. With zero observations, score is null and level is `insufficient_data`. This is an uncalibrated activity heuristic, not probability or fire severity.

## Sentinel-2 NBR and dNBR

The implementation reads Sentinel-2 L2A B8 (NIR), B12 (SWIR), and SCL. For valid pixels, it subtracts 1000 DN from both spectral bands, then computes:

```text
NBR = (NIR - SWIR) / (NIR + SWIR)
dNBR = NBR_pre - NBR_post
```

SCL classes 2, 4, and 5 are retained; all other classes and nodata pixels are masked. Corrected bands must be positive. Per-period NBR uses a per-pixel median over usable scenes. A valid dNBR pixel requires finite pre and post composites within the circle mask. Pixels `dNBR >= dnbr_threshold` count toward indicated area. Threshold defaults to 0.10 and is experimental. Area uses nominal 20 m grid pixel area. The hard-coded BOA offset is inferred from typical processing baseline and must be validated against source metadata; code currently does not read band offsets. The result indicates spectral change, not confirmed burn scar or fire causation.
