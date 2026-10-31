# Roadmap and integration targets

This is a status register based on current repository evidence, not a commitment or evidence that an item is complete.

## Integration target

- Connect the Next.js server-side application to the existing FastAPI endpoints when contracts and deployment secrets are ready.
- Keep database writes in the Next.js/backend boundary according to the architecture intent recorded in existing AI audit notes; no Supabase client or AI-service database writer is implemented here.
- Chain separate clustering, filtering, risk and matching calls in a caller/test runner where needed; do not infer that the current endpoints orchestrate each other.

## Candidate follow-up work

| Candidate | Evidence/status | Release gate |
|---|---|---|
| Verify and migrate configured CDSE STAC URL from deprecated legacy default | Official docs identify v1 endpoint; code retains legacy default; application change outside docs-only scope | Confirm deployment override, adjust source/config separately, test live STAC search |
| Re-run burn-area three-request repeatability with STAC/S3 reachable | Current attempt stopped at STAC DNS; B12/SCL issue unverified | Capture sanitized status, scenes, pixel counts, coverage, area and timings |
| Add bounded cache lifecycle and stronger cache integrity checks | Current cache has no eviction and checks only nonzero size | Define deployment disk budget, safe eviction semantics and tests |
| Add full pipeline mock integration tests | Current suite verifies modules/routes individually; complete chains are not covered | Use existing endpoints/services and fixtures without adding orchestration API |
| Review internal-auth behavior consistency in development | Ping/cluster allow empty key in development; other internal routes return 503 | Decide intended local developer behavior and preserve environment security boundary |
| Pin model checkpoints to immutable revisions and record provenance/license | Runtime uses local unpinned paths; model files ignored | Verify exact artifact hashes, publisher terms and deployment supply chain |
| Validate risk/matching/dNBR against independent reference data | No current independent ground-truth metrics | Establish protocol, labeled sample and review before claiming accuracy |
| Verify container smoke and writable GeoTIFF path | Docker unavailable in last audit; no output volume in Compose | Run on Docker host and define whether output should be ephemeral or persistent |

No items above were implemented by the documentation task.
