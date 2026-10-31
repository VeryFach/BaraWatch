# BaraWatch AI Audit Report

> **Historical audit snapshot.** This report describes an earlier service state and repairs. Its four-route inventory/readiness wording is no longer current. For current endpoints, tests, and known gaps, see the [service README](../README.md), [Testing](TESTING.md), and [Limitations](LIMITATIONS.md). Historical repair notes below are retained as project history, not as a fresh audit.

## Executive summary

The FastAPI service is operational for health, internal ping, clustering, and
mockable vision inference. The initial application import was broken because the
registered vision router imported a nonexistent `app.services.vision.detector`.
That integration issue is repaired. Real vision inference remains dependent on
provisioning the two model checkpoints; the service fails explicitly with HTTP
503 when they are absent.

## Architecture

- `app/main.py` creates the FastAPI application and registers health, system,
  clustering, and vision routers.
- `app/services/firms.py` parses and downloads NASA FIRMS CSV data.
- `app/services/clustering/dbscan.py` performs confidence filtering, temporal
  pre-segmentation, and spatial Haversine DBSCAN. It is not joint space-time
  clustering.
- `app/services/vision/detector.py` lazily loads and caches Ultralytics models.
- `app/services/vision/fusion.py` combines native detections without treating
  confidences as calibrated probabilities.
- The service has no Supabase or database write path.

## Confirmed findings and repairs

| Severity | Finding | Repair |
|---|---|---|
| High | Vision router imported missing `detector.py`; application startup failed. | Added lazy detector adapter and package initializer. |
| High | Vision endpoint passed the complete prediction envelope to a two-argument fusion function. | Pass each model's native detections explicitly. |
| Medium | Vision API key was read directly from the process environment, unlike the central settings model. | Added `BARAWATCH_AI_API_KEY` settings field and dependency injection. |
| Medium | Contradictory smoke-origin detections returned an undocumented `uncertain` state. | Use the documented `ambiguous` state and set `needs_review`. |
| Medium | Runtime dependencies used by imported clustering/vision modules were optional-only, so a plain package install could fail at runtime. | Made runtime imports explicit project dependencies. |
| Medium | No CPU-first container, health check, or model cache volumes existed. | Added Dockerfile, Compose configuration, non-root execution, and cache volumes. |
| High | Container startup failed because multipart form parsing was not declared. | Added `python-multipart` to runtime dependencies and verified container startup. |

## Remaining risks

- Model checkpoints are not included in the repository or image. Provision them
  through the configured model volume before calling the vision endpoint.
- Smoke source classification is tentative image evidence, not physical-source
  verification.
- FIRMS live availability, rate limits, and credentials were not exercised in
  automated tests.
- Model accuracy, calibration, licensing, and CPU latency require a separate
  representative evaluation.

## Readiness

Based on the automated verification in `docs/TEST_RESULTS.md`, the supported
status is **READY_FOR_LOCAL_DEVELOPMENT**. Docker demo readiness depends on
successful local image build and checkpoint provisioning.
