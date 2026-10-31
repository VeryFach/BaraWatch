# Limitations and evidence

This page separates current code facts from historical observations and unresolved questions. No concern here is a claim of field accuracy.

## Confirmed current limitations

- There is no database integration or automated multi-endpoint pipeline in FastAPI. The Next.js/Supabase arrangement is an integration target, not a completed AI feature.
- NASA FIRMS parsing/fetch is a helper/CLI path; `/v1/cluster` receives hotspot JSON from its caller. FIRMS detections are not independently confirmed wildfire ground truth.
- Vision output depends on two local, Git-ignored checkpoint files. Model revisions are not pinned in code, and no verified precision/recall/F1/mAP or calibration evidence is documented.
- Matching and risk outputs are heuristics. Risk response explicitly says it is not calibrated fire probability.
- Burn-area `indicated_area_ha` counts pixels over an experimental dNBR threshold. It is not verified burned area or fire attribution. BOA offset is hardcoded/inferred and source metadata is not read. Projection, edge, cloud and acquisition differences are listed in response limitations.
- Raster cache has atomic write and hash-derived filenames but no size/age eviction. Reuse validation checks only that a file exists and is nonzero length.
- Health is liveness only, with empty `active_models`; it does not check readiness or upstream dependencies.
- No application-level rate limiter or per-caller quota is configured.
- End-to-end cross-module test coverage is incomplete. Existing tests are mostly unit and mock/API tests.
- The repository's GitHub Actions workflow files are present but empty (zero bytes), so they do not run CI/deployment checks or scheduled ingestion.
- Compose uses a read-only root filesystem and no output volume. Optional GeoTIFF saving may fail without an explicitly mounted writable directory.
- The code default STAC URL is the CDSE legacy endpoint that official documentation says was deprecated from 17 November 2025. Current supported catalog docs identify the v1 endpoint. Code/config was not changed in this documentation-only task.
- No repository-level project license was found.

## Historical and current verification observations

- Existing output files record an earlier successful dNBR example with 27.24 ha indicated area, 97.37% valid coverage, and three usable scenes per period. This is a historical local artifact, not independently validated ground truth or a fresh reproducibility result.
- A documentation-time audit on 31 October 2026 sent three identical burn-area requests through FastAPI. All returned HTTP 503 at STAC DNS/connect time, before scene selection and raster access. This does not verify or falsify the historical B12/SCL read issue.
- The audit test suite passed 74 tests with two deprecation warnings. Lint and compile checks passed in the same audit. This does not imply live provider success.
- Docker smoke testing was blocked because the Docker daemon socket could not be reached in the audit environment.
- A previous validation document claimed a public tunnel check and a smaller test suite. Its environment/date details are historical and must not be treated as current deployment evidence.

## Unverified concerns

- Historical reports mention intermittent B12/SCL zero-valid-pixel reads. The current code downloads JP2 assets first, retries local Rasterio reads three times, and drops unusable scenes; current tests mock/synthesize data and do not reproduce this upstream issue.
- Current availability/quotas for the configured CDSE S3 account and FIRMS key were not verified. Provider quota and terms can change.
- Cache races are reduced by unique temporary files plus atomic replacement, but concurrent cache behavior and disk pressure have no dedicated stress tests.
- Production deployment controls, secret-manager wiring, reverse-proxy limits, and actual caller authorization were not inspected in an active deployment.
- Local `.env` may override the STAC URL; the contents were not read or disclosed during documentation preparation. Verify deployment configuration securely.

## Accuracy and intended use

This service is a monitoring and triage aid. Do not present it as an authoritative emergency-response source or use its scores/dNBR indication as validated probability or confirmed burned perimeter. Independent labeled imagery, field reports, calibration and external scientific review are needed for quantitative performance claims.
