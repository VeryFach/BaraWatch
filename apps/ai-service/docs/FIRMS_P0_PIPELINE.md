# P0 FIRMS ingestion

The scheduled backend route is `GET /api/cron/ingest-hotspots`, protected by `Authorization: Bearer $CRON_SECRET`. GitHub Actions invokes it every 30 minutes; configure the Actions variable `APP_BASE_URL` and secret `CRON_SECRET` separately. The route also requires backend-only `AI_SERVICE_URL`, `AI_INTERNAL_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `SUPABASE_SECRET_KEY`. The AI service requires `FIRMS_MAP_KEY` and the same `AI_INTERNAL_KEY`. Never place these values in client-side variables.

## Data flow

1. The cron route claims a database lease and creates a `pipeline_runs` row.
2. It obtains the pilot boundary bbox from `regions` and reads `firms_products` from `system_settings`.
3. For each source, it calls the internal `/v1/firms/fetch-parse` adapter. NASA CSV parsing remains in `app.services.firms`; the adapter returns the parsed source fields.
4. The backend sends normalized rows to `upsert_firms_hotspots`. FIRMS hash IDs are ignored; the existing natural unique key creates or reuses Supabase UUIDs. `confidence_raw` is retained and `unknown` maps to SQL NULL.
5. `annotate_hotspots(p_run_id)` is the only P0 filter. It preserves records and writes each existing `filter_status`. The separate `/v1/hotspots/filter` endpoint is an independent stateless filtering interface; calling both would create competing policies, so the ingestion job does not call it.
6. Only `filter_status='kept'` rows without an incident link go to `/v1/cluster`, using database UUIDs and DBSCAN settings from `system_settings`.
7. `reconcile_firms_incidents` links hotspots and creates/updates incidents atomically. It uses a transaction-scoped advisory lock and row locks; no database transaction spans an HTTP request.

## Migration

Review `supabase/migrations/20261031000010_firms_pipeline_atomic.sql`, then apply it to a local Supabase database first with `supabase migration up --local`. Check RPC permissions and run the concurrency/integration tests before applying it to any shared environment. This implementation never applies migrations automatically. Do not run `supabase db push` against production as part of application startup.

## Operational limits

The FIRMS adapter caps one upstream response at 20 MiB and one source batch at 20,000 rows. The DBSCAN request schema also caps its hotspot list at 20,000. A larger combined kept set fails the AI request and leaves the pipeline marked failed; rows remain persisted and auditable for a later retry. Source failures produce a partial run when at least one source succeeds. No WhatsApp notification code is invoked.
