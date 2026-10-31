# Security and reliability

## Authentication

- `GET /health` is unauthenticated and reveals application name, version and environment.
- `/v1/ping` and `/v1/cluster` use `require_internal_key` (`X-Internal-Key`). When a key is configured, comparison is constant-time and missing/wrong key receives 401. In development only, an empty key permits these two routes. Staging/production `Settings` require `AI_INTERNAL_KEY` length ≥32.
- Matching, filtering, risk and burn-area call `verify_internal_key` from the matching module. It uses constant-time comparison, returns 503 if no key is configured in any environment and 401 for missing/wrong request key when configured. This differs from the development bypass used by ping/cluster; it is an implementation inconsistency to review separately.
- Vision uses `X-API-Key`, configured as `BARAWATCH_AI_API_KEY`; empty server setting returns 503, invalid/missing request header returns 401.
- FastAPI `/docs` and `/openapi.json` are not disabled or authenticated in this code.

Keep keys server-side. A Next.js server caller may hold internal credentials, but a browser must not receive them. If public exposure is used, put a trusted proxy/gateway in front and verify that it cannot be bypassed. Do not assume Cloudflare or Supabase protection exists in this repository.

## Input and resource limits

- Vision MIME and decoded image format are restricted to JPEG/PNG, file size to 10 MiB, pixel area to 20 million.
- Cluster input caps hotspots at 20,000 and open incidents at 1,000; matching caps candidates at 5,000; filter caps hotspots at 5,000 and known heat sources at 500.
- Burn-area limits radius to 5 km, each period to 90 days, selected scenes to at most 5 per period, and uses bounded UTM pixel dimensions implied by radius and 20 m grid.
- FIRMS helper allowlists products, validates bbox and restricts days to 1–5.
- Raster asset hrefs are constrained to S3 bucket `eodata`, with traversal components rejected. Output filenames are constructed from validated coordinates/dates, not arbitrary user path fragments.
- No application-level request rate limiter or per-caller quota is configured. Some authenticated requests can invoke substantial local inference or upstream data transfer; add limits at a trusted gateway if exposed beyond a controlled backend.

## Filesystem and cache

Container runs non-root with read-only root and `/tmp` tmpfs; model mount is read-only. Local deployments are not automatically sandboxed. Raster cache uses hash-derived names and atomic rename but has no max byte count, age eviction, interprocess lock or content integrity checksum beyond the filename and nonempty file check. Concurrent downloads use unique temporary names and atomic replace. GeoTIFF writes require a writable configured directory.

## Logs and secrets

Request logs include request ID, method, path, status and duration. Burn-area logs include scene IDs and pixel counts. Avoid logging credentials, request headers, full FIRMS key-bearing URLs, image contents, or S3 secret material. The FIRMS helper embeds its MAP_KEY in URL path and `httpx` exceptions can contain request context when propagated by local scripts; sanitize any manually collected traceback before sharing.

## Third-party/network reliability

External STAC and FIRMS requests have explicit timeouts and redirects disabled. S3 uses boto3 without an application-level retry policy shown here. Raster reads retry three times after local download, with 0.5 and 1 second waits. STAC has no retry. There is no circuit breaker, quota scheduler, cache eviction, or provider fallback. The default STAC catalog URL is deprecated per current CDSE docs. Upstream outages produce failed requests; they are not treated as “no fire.”

## Operational recommendations

- Use staging/production modes and randomly generated, separate keys; deploy via secret storage.
- Restrict network access to internal routes and upload endpoint; consider restricting Swagger in production at the proxy layer.
- Set resource/time limits at the reverse proxy, monitor disk/tmpfs usage and upstream error rates.
- Rotate a key through the provider/secret store and all authorized callers; revoke the old key after coordination.
- Evaluate model provenance/license and validate against independently labeled data before public or commercial use.

No secrets were included in this documentation. The service has not been declared production-ready.
