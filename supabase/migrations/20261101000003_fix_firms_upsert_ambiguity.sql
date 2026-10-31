-- Resolve PL/pgSQL's output-column / table-column name ambiguity in the
-- upsert conflict target. The function's input/output contract is unchanged.
create or replace function public.upsert_firms_hotspots(p_owner uuid, p_run uuid, p_rows jsonb)
returns table(
  id uuid,
  latitude numeric,
  longitude numeric,
  acq_at timestamptz,
  satellite text,
  instrument text,
  confidence_raw text,
  confidence_level text,
  frp numeric
)
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
#variable_conflict use_column
begin
  if jsonb_typeof(p_rows) is distinct from 'array'
     or jsonb_array_length(p_rows) > 20000
     or p_owner is null
     or p_run is null then
    raise exception 'invalid hotspot batch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_rows) x
    where nullif(x->>'latitude', '') is null
       or (x->>'latitude')::numeric not between -90 and 90
       or nullif(x->>'longitude', '') is null
       or (x->>'longitude')::numeric not between -180 and 180
       or nullif(x->>'acq_at', '') is null
       or nullif(x->>'satellite', '') is null
       or nullif(x->>'instrument', '') is null
       or nullif(x->>'source', '') is null
       or x->>'source' not in (
         'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT', 'MODIS_NRT'
       )
       or (nullif(x->>'frp', '') is not null and (x->>'frp')::numeric < 0)
  ) then
    raise exception 'invalid hotspot record' using errcode = '22023';
  end if;

  perform 1
  from public.pipeline_leases l
  where l.job_name = 'firms'
    and l.owner_token = p_owner
    and l.run_id = p_run
    and l.lease_expires_at > clock_timestamp()
  for update;
  if not found then
    raise exception 'pipeline lease lost' using errcode = '55000';
  end if;

  return query
    insert into public.hotspots as h (
      ingest_run_id, latitude, longitude, acq_at, satellite, instrument,
      source_product, confidence_raw, confidence_level, frp
    )
    select p_run,
      (x->>'latitude')::numeric,
      (x->>'longitude')::numeric,
      (x->>'acq_at')::timestamptz,
      x->>'satellite',
      x->>'instrument',
      x->>'source',
      nullif(x->>'confidence_raw', ''),
      case
        when x->>'confidence_level' in ('low', 'nominal', 'high')
          then x->>'confidence_level'
        else null
      end,
      nullif(x->>'frp', '')::numeric
    from (
      select distinct on (
        x->>'satellite', x->>'instrument', x->>'acq_at',
        (x->>'latitude')::numeric(8,5), (x->>'longitude')::numeric(8,5)
      ) x
      from jsonb_array_elements(p_rows) x
      order by
        x->>'satellite', x->>'instrument', x->>'acq_at',
        (x->>'latitude')::numeric(8,5), (x->>'longitude')::numeric(8,5)
    ) d
    on conflict (satellite, instrument, acq_at, latitude, longitude)
    do update set
      ingest_run_id = excluded.ingest_run_id,
      source_product = excluded.source_product,
      confidence_raw = excluded.confidence_raw,
      confidence_level = excluded.confidence_level,
      frp = excluded.frp
    returning h.id, h.latitude, h.longitude, h.acq_at, h.satellite, h.instrument,
      h.confidence_raw, h.confidence_level, h.frp;
end;
$$;

revoke all on function public.upsert_firms_hotspots(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_firms_hotspots(uuid, uuid, jsonb)
  to service_role;
