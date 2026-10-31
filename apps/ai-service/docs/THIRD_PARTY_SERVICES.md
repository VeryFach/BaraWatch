# Third-party services and data

This inventory separates service calls in the FastAPI code from monorepo targets and items that appear only in historical notes. External quota and license terms can change; links below point to provider documentation. Checked 31 October 2026 where noted.

| Provider/service | Direct FastAPI use | Data or function | Auth/config | Current status |
|---|---|---|---|---|
| NASA FIRMS | Helper/CLI only, not an HTTP route | Active-fire/hotspot CSV from VIIRS/MODIS | `FIRMS_MAP_KEY` | Implemented helper; live API use not verified in the current test run |
| Copernicus CDSE STAC | Burn-area endpoint | Sentinel-2 L2A scene metadata and asset hrefs | Public STAC query; `COPERNICUS_STAC_URL` override | Implemented; current live request failed DNS; code default is a deprecated legacy endpoint |
| Copernicus CDSE S3 | Burn-area endpoint | JP2 raster assets B8/B12/SCL | `CDSE_S3_ACCESS_KEY`, `CDSE_S3_SECRET_KEY` | Implemented, credentials required; current live raster access not verified |
| Sentinel-2 L2A | Data collection through CDSE | B8, B12, SCL for NBR/dNBR estimate | CDSE access model above | Implemented; spectral change is not ground truth |
| Hugging Face-hosted model repositories | Provenance for local weight files; no runtime download in detector | YOLO checkpoint source | No runtime token configured | Model files are locally provisioned and ignored by Git; revision pinning and license review are incomplete |
| PyPI package registry | Build/install dependency source | Python libraries | Package installer configuration | Install-time dependency; not a wildfire data API |
| Docker Hub Python base image | Dockerfile build | Python 3.11 slim container base | Docker daemon/registry access | Build-time dependency |

## NASA FIRMS

- Provider: NASA LANCE Fire Information for Resource Management System.
- Official references: [Area API](https://firms.modaps.eosdis.nasa.gov/api/area), [FIRMS web services](https://firms.modaps.eosdis.nasa.gov/web-services/), [API usage tutorial](https://firms.modaps.eosdis.nasa.gov/content/academy/data_api/firms_api_use.html), [MAP_KEY registration](https://firms.modaps.eosdis.nasa.gov/api/map_key).
- Code: `app/services/firms.py`; CLI: `scripts/run_hotspots.py --fetch`.
- Data: CSV area query for allowlisted `VIIRS_NOAA20_NRT`, `VIIRS_NOAA21_NRT`, `VIIRS_SNPP_NRT`, or `MODIS_NRT`, caller-supplied bounding box, 1–5 days and optional date. Parser uses location, acquisition date/time, satellite, instrument, confidence and FRP fields where present.
- Authentication: free FIRMS MAP_KEY embedded in the request path, provided from Pydantic setting `FIRMS_MAP_KEY`. Never place it in source or browser code. The current code sets HTTP timeout 40 seconds and rejects HTML responses. It raises for non-success HTTP status; there is no fallback data source in this helper.
- Format: CSV, normalized to Pydantic hotspot objects. Timestamps are interpreted as UTC. The CSV parser is not exposed as an HTTP ingestion endpoint.
- Quota: official Area API documentation currently states a MAP_KEY limit of 5,000 transactions per 10-minute interval; larger queries can count as multiple transactions. Check provider documentation for current details and account status.
- Use caveat: FIRMS active-fire products identify satellite thermal anomalies/detections, not independently confirmed wildfire ground truth. False positives, omissions, cloud effects, detection timing and product latency must be considered.
- License, attribution and redistribution: no separate product-level legal review was found in this repository. Verify current NASA/FIRMS data-use and attribution terms for the specific product and distribution use. Do not infer that a public API key authorizes redistribution of all derived material.
- Privacy/security: the request discloses the requested bounding box and date range to NASA. Since MAP_KEY is placed in a URL, avoid logging full request URLs/errors. It is not intentionally included in BaraWatch structured request logs.

## Copernicus Data Space Ecosystem and Sentinel-2

- Provider: Copernicus Data Space Ecosystem (CDSE), delivered through EU/ESA ecosystem infrastructure.
- Official references: [STAC API documentation](https://documentation.dataspace.copernicus.eu/APIs/STAC.html), [S3 access documentation](https://documentation.dataspace.copernicus.eu/APIs/S3.html), [current quotas and limitations](https://documentation.dataspace.copernicus.eu/Quotas.html), [CDSE terms and conditions](https://dataspace.copernicus.eu/terms-and-conditions), [Sentinel data legal notice](https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice).
- Code: `app/services/burn_area/copernicus_client.py`, `raster_processor.py`, `estimator.py`.
- STAC query: public `POST /search` to an allowlisted official catalog, collection `sentinel-2-l2a`, bounding box from requested point/radius, time interval and item limit. `httpx` timeout is 35 seconds; redirects disabled. Scene ordering prioritizes cloud metadata, acquisition datetime, then scene ID.
- **Endpoint mismatch:** code currently defaults to `https://catalogue.dataspace.copernicus.eu/stac`. Current CDSE STAC docs describe `https://stac.dataspace.copernicus.eu/v1/` as the catalog endpoint and state the legacy URL was deprecated from 17 November 2025. Code also accepts other allowlisted URLs. This docs-only task leaves the application untouched; verify the deployed `COPERNICUS_STAC_URL` and update code in a separately approved implementation task.
- S3 access: CDSE-issued access/secret keys are passed to boto3/rasterio for fixed bucket `eodata` at `eodata.dataspace.copernicus.eu`. S3 href validation rejects any other scheme/bucket and rejects `..` path components. Assets are downloaded to a local JP2 cache; cache lifecycle and integrity constraints are described in [Limitations](LIMITATIONS.md).
- Data: Sentinel-2 L2A B8 (NIR), B12 (SWIR), and SCL assets. STAC search is public in code; raster access needs `CDSE_S3_ACCESS_KEY` and `CDSE_S3_SECRET_KEY`. No OAuth token flow is implemented.
- Failure: STAC, S3, decode, missing asset, no-scene and no-overlap failures can result in 422 (no usable imagery) or 503 (other upstream/processing failure). There is no alternate provider fallback. Raster reads retry three times with short waits after a successful download; STAC search itself does not retry.
- Quotas: CDSE publishes account-type-dependent quotas and limits. This implementation does not enforce a request budget or disclose a verified quota tier. Consult the linked current quota page before production use.
- Licensing: CDSE states Sentinel data are available on a free, full and open basis under the Sentinel Data Legal Notice. Other portal content can have different terms; check attribution and redistribution requirements for the exact data and output. Do not assume all services or high-volume processing are unlimited.
- Privacy/security: requests expose location, radius and acquisition windows to CDSE. Keep S3 keys out of logs, source control and public client apps. Rotate credentials through CDSE and deployment secret storage if exposed; no key values are documented here.
- Ground truth: dNBR is a spectral-change proxy; cloud masking and a positive threshold do not confirm a wildfire or establish burn cause.

## YOLO checkpoints and Hugging Face

- Code provenance: `app/services/vision/detector.py`; intended source repositories are recorded in [Vision Model Contract](VISION_MODEL_CONTRACT.md): [mfranzon/fire-smoke-yolov8](https://huggingface.co/mfranzon/fire-smoke-yolov8) and [touati-kamel/yolov8s-forest-fire-detection](https://huggingface.co/touati-kamel/yolov8s-forest-fire-detection).
- Files expected locally: `models/weights/fire_smoke_yolov8.pt` and `models/weights/model.pt`. The detector does not fetch from Hugging Face at request time. The local checkout contained files with these names, but Git ignores them; their hashes and immutable source revisions are not pinned by the application.
- Authentication: none in the runtime detector. Manual provisioning may involve external provider access; use official account/token practices if required, but no Hugging Face token variable is configured in this service.
- License: the mfranzon Hugging Face model page displayed `AGPL-3.0` when inspected 31 Oct 2026. The Touati page did not show a verified license in the inspected repository metadata. Verify the current model card, weight-specific terms, training-data terms, and Ultralytics dependency obligations before redistribution or commercial deployment. Do not treat repository availability as a grant of rights.
- Failure: absent file raises `FileNotFoundError`, mapped by vision route to 503. No fallback model or empty-detection substitution is used.
- Privacy: uploaded image bytes are processed in the service process; the detector code passes the in-memory PIL image to local model inference and contains no image upload to Hugging Face. Runtime model downloads are not performed by this path.

## Other monorepo integrations

- **Next.js:** present in `apps/web`. The inspected public API routes read local dummy fixtures. The WhatsApp webhook route returns 501 (“not configured yet”); hotspot ingestion cron route reports not configured. These are not connected to this FastAPI service in current source.
- **Supabase:** no Supabase SDK/dependency or active direct integration was found in the inspected web package or AI service. Root README contains local Supabase CLI setup instructions, which are not evidence of an application connection. Treat use as planned/unverified.
- **Twilio / WhatsApp provider:** no provider SDK or configured external call found. Webhook is a stub. Treat as planned/unimplemented.
- **Cloudflare:** no active integration/configuration in the inspected AI service or web source. An older validation report references a historical public tunnel check; that does not establish a currently deployed service. Do not rely on it for current endpoint status.
- **Hugging Face Hub package:** `huggingface_hub` is a declared dependency, but current runtime inference reads local files and does not call the Hub.

## Terms and current verification

Provider terms, API schemas, quotas and model cards can change. Recheck official links before release. This document does not grant permission to redistribute source imagery, model checkpoints, or outputs. Neither FIRMS detections nor Sentinel-2-derived changes are independent ground truth.
