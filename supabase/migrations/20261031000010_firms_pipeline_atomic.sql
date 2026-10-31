-- P0 FIRMS job lease and atomic incident reconciliation.
-- No transaction is held while the application calls NASA or the AI service.
create table public.pipeline_leases (
  job_name text primary key check (job_name = 'firms'),
  owner_token uuid not null,
  run_id uuid not null references public.pipeline_runs(id) on delete cascade,
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.pipeline_leases enable row level security;
revoke all on public.pipeline_leases from public, anon, authenticated;
grant select, insert, update, delete on public.pipeline_leases to service_role;

create or replace function public.claim_firms_pipeline(p_owner uuid, p_lease_seconds integer default 180)
returns table(acquired boolean, run_id uuid) language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_run uuid; v_owner uuid; v_exp timestamptz;
begin
  if p_owner is null or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then
    raise exception 'invalid lease request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('barawatch:firms', 0));
  select owner_token, l.run_id, lease_expires_at into v_owner, v_run, v_exp
    from public.pipeline_leases l where job_name = 'firms' for update;
  if found and v_exp > clock_timestamp() then
    return query select false, v_run; return;
  end if;
  if found then
    update public.pipeline_runs set status='failed', finished_at=now(), error='Lease expired'
      where id=v_run and status='running';
  end if;
  insert into public.pipeline_runs(job_name, trigger_type, status)
    values ('firms','schedule','running') returning id into v_run;
  insert into public.pipeline_leases(job_name, owner_token, run_id, lease_expires_at)
    values ('firms', p_owner, v_run, clock_timestamp() + make_interval(secs => p_lease_seconds))
    on conflict (job_name) do update set owner_token=excluded.owner_token, run_id=excluded.run_id,
      lease_expires_at=excluded.lease_expires_at, updated_at=now();
  return query select true, v_run;
end $$;

create or replace function public.renew_firms_pipeline(p_owner uuid, p_run uuid, p_lease_seconds integer default 180)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_owner is null or p_run is null or p_lease_seconds is null or p_lease_seconds not between 30 and 900 then raise exception 'invalid lease duration' using errcode='22023'; end if;
  update public.pipeline_leases set lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds), updated_at=now()
   where job_name='firms' and owner_token=p_owner and run_id=p_run and lease_expires_at>clock_timestamp();
  return found;
end $$;

create or replace function public.finish_firms_pipeline(p_owner uuid, p_run uuid, p_status text, p_count integer, p_error text default null)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if p_owner is null or p_run is null or p_status is null or p_status not in ('success','partial','failed') or p_count is null or p_count < 0 then raise exception 'invalid completion' using errcode='22023'; end if;
  perform 1 from public.pipeline_leases where job_name='firms' and owner_token=p_owner and run_id=p_run for update;
  if not found then return false; end if;
  update public.pipeline_runs set status=p_status, records_fetched=p_count, error=left(p_error,1000), finished_at=now()
   where id=p_run and status='running' and exists(select 1 from public.pipeline_leases where job_name='firms' and owner_token=p_owner and run_id=p_run);
  if not found then return false; end if;
  delete from public.pipeline_leases where job_name='firms' and owner_token=p_owner and run_id=p_run;
  return true;
end $$;

create or replace function public.upsert_firms_hotspots(p_owner uuid, p_run uuid, p_rows jsonb)
returns table(id uuid, latitude numeric, longitude numeric, acq_at timestamptz, satellite text, instrument text, confidence_raw text, confidence_level text, frp numeric)
language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>20000 or p_owner is null or p_run is null then raise exception 'invalid hotspot batch' using errcode='22023'; end if;
  if exists (select 1 from jsonb_array_elements(p_rows) x where
      nullif(x->>'latitude','') is null or (x->>'latitude')::numeric not between -90 and 90 or
      nullif(x->>'longitude','') is null or (x->>'longitude')::numeric not between -180 and 180 or
      nullif(x->>'acq_at','') is null or nullif(x->>'satellite','') is null or nullif(x->>'instrument','') is null or
      nullif(x->>'source','') is null or
      x->>'source' not in ('VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','VIIRS_SNPP_NRT','MODIS_NRT') or
      (nullif(x->>'frp','') is not null and (x->>'frp')::numeric < 0)) then
    raise exception 'invalid hotspot record' using errcode='22023';
  end if;
  perform 1 from public.pipeline_leases where job_name='firms' and owner_token=p_owner and run_id=p_run and lease_expires_at>clock_timestamp() for update;
  if not found then
    raise exception 'pipeline lease lost' using errcode='55000';
  end if;
  return query
    insert into public.hotspots(ingest_run_id, latitude, longitude, acq_at, satellite, instrument, source_product, confidence_raw, confidence_level, frp)
    select p_run, (x->>'latitude')::numeric, (x->>'longitude')::numeric, (x->>'acq_at')::timestamptz,
      x->>'satellite', x->>'instrument', x->>'source', nullif(x->>'confidence_raw',''),
      case when x->>'confidence_level' in ('low','nominal','high') then x->>'confidence_level' else null end,
      nullif(x->>'frp','')::numeric
    from (select distinct on ((x->>'satellite'),(x->>'instrument'),(x->>'acq_at'),((x->>'latitude')::numeric(8,5)),((x->>'longitude')::numeric(8,5))) x
      from jsonb_array_elements(p_rows) x
      order by (x->>'satellite'),(x->>'instrument'),(x->>'acq_at'),((x->>'latitude')::numeric(8,5)),((x->>'longitude')::numeric(8,5))) d
    on conflict (satellite,instrument,acq_at,latitude,longitude) do update set
      ingest_run_id=excluded.ingest_run_id, source_product=excluded.source_product,
      confidence_raw=excluded.confidence_raw, confidence_level=excluded.confidence_level, frp=excluded.frp
    returning hotspots.id, hotspots.latitude, hotspots.longitude, hotspots.acq_at, hotspots.satellite, hotspots.instrument,
      hotspots.confidence_raw, hotspots.confidence_level, hotspots.frp;
end $$;

create or replace function public.reconcile_firms_incidents(p_owner uuid, p_run uuid, p_clusters jsonb)
returns integer language plpgsql security definer set search_path = pg_catalog, public, extensions as $$
declare c jsonb; hid uuid; incident uuid; n integer:=0; geom extensions.geometry;
begin
  if jsonb_typeof(p_clusters) is distinct from 'array' or jsonb_array_length(p_clusters)>10000 or p_owner is null or p_run is null then raise exception 'invalid clusters' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('barawatch:firms:reconcile',0));
  perform 1 from public.pipeline_leases where job_name='firms' and owner_token=p_owner and run_id=p_run and lease_expires_at>clock_timestamp() for update;
  if not found then raise exception 'pipeline lease lost' using errcode='55000'; end if;
  for c in select value from jsonb_array_elements(p_clusters) loop
    if jsonb_typeof(c->'hotspot_ids') is distinct from 'array' or jsonb_array_length(c->'hotspot_ids')<1 or
       jsonb_typeof(c->'centroid') is distinct from 'object' or
       nullif(c->'centroid'->>'latitude','') is null or
       (c->'centroid'->>'latitude')::numeric not between -90 and 90 or
       nullif(c->'centroid'->>'longitude','') is null or
       (c->'centroid'->>'longitude')::numeric not between -180 and 180 or
       nullif(c->>'hotspot_count','') is null or
       (c->>'hotspot_count')::integer <> jsonb_array_length(c->'hotspot_ids') or
       nullif(c->>'first_detected_at','') is null or nullif(c->>'last_detected_at','') is null then
      raise exception 'invalid cluster record' using errcode='22023';
    end if;
    if (select count(distinct value) from jsonb_array_elements_text(c->'hotspot_ids')) <> jsonb_array_length(c->'hotspot_ids') or
       exists(select 1 from jsonb_array_elements_text(c->'hotspot_ids') x(id)
         left join public.hotspots h on h.id=x.id::uuid
         where h.id is null or h.ingest_run_id<>p_run or h.filter_status<>'kept') then
      raise exception 'cluster references invalid hotspot ids' using errcode='22023';
    end if;
    incident := null;
    if c->>'matched_incident_id' is not null then
      select i.id into incident from public.incidents i where i.id=(c->>'matched_incident_id')::uuid and i.status in ('new','confirmed','escalated','in_progress','contained') for update;
    end if;
    if incident is null then
      select h.incident_id into incident from public.hotspots h join jsonb_array_elements_text(c->'hotspot_ids') x(id) on h.id=x.id::uuid
       where h.incident_id is not null order by h.acq_at desc limit 1 for update of h;
    end if;
    if incident is null then
      insert into public.incidents(source,status,centroid,footprint,first_detected_at,last_detected_at,hotspot_count)
      values('satellite','new',extensions.st_setsrid(extensions.st_makepoint((c->'centroid'->>'longitude')::float8,(c->'centroid'->>'latitude')::float8),4326),
        case when c->'footprint' is null or c->'footprint'='null'::jsonb then null else extensions.st_setsrid(extensions.st_geomfromgeojson((c->'footprint')::text),4326) end,
        (c->>'first_detected_at')::timestamptz,(c->>'last_detected_at')::timestamptz,(c->>'hotspot_count')::int)
      returning id into incident;
    else
      update public.incidents i set centroid=extensions.st_setsrid(extensions.st_makepoint((c->'centroid'->>'longitude')::float8,(c->'centroid'->>'latitude')::float8),4326),
        footprint=case when c->'footprint' is null or c->'footprint'='null'::jsonb then i.footprint else extensions.st_setsrid(extensions.st_geomfromgeojson((c->'footprint')::text),4326) end,
        first_detected_at=least(i.first_detected_at,(c->>'first_detected_at')::timestamptz), last_detected_at=greatest(i.last_detected_at,(c->>'last_detected_at')::timestamptz),
        hotspot_count=(select count(*) from public.hotspots where incident_id=i.id or id in (select value::uuid from jsonb_array_elements_text(c->'hotspot_ids'))), updated_at=now()
      where i.id=incident;
    end if;
    for hid in select value::uuid from jsonb_array_elements_text(c->'hotspot_ids') loop
      update public.hotspots set incident_id=incident where id=hid and (incident_id is null or incident_id=incident);
      if not found then raise exception 'hotspot incident conflict' using errcode='23514'; end if;
    end loop;
    n:=n+1;
  end loop;
  return n;
end $$;

create or replace function public.get_firms_cluster_inputs(p_run uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, public, extensions as $$
  select jsonb_build_object(
    'hotspots', coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'latitude',h.latitude,'longitude',h.longitude,'acq_at',h.acq_at,
      'satellite',h.satellite,'instrument',h.instrument,'confidence_raw',h.confidence_raw,'confidence_level',coalesce(h.confidence_level,'unknown'),'frp',h.frp))
      from public.hotspots h where h.ingest_run_id=p_run and h.filter_status='kept' and h.incident_id is null), '[]'::jsonb),
    'open_incidents', coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'latitude',extensions.st_y(i.centroid),'longitude',extensions.st_x(i.centroid),'last_detected_at',i.last_detected_at))
      from (select * from public.incidents where status in ('new','confirmed','escalated','in_progress','contained') and centroid is not null order by last_detected_at desc limit 1000) i), '[]'::jsonb)
  )
$$;

create or replace function public.get_firms_pilot_bbox()
returns jsonb language sql stable security definer set search_path = pg_catalog, public, extensions as $$
  select jsonb_build_array(extensions.st_xmin(extensions.st_3dextent(r.geom)),
    extensions.st_ymin(extensions.st_3dextent(r.geom)), extensions.st_xmax(extensions.st_3dextent(r.geom)),
    extensions.st_ymax(extensions.st_3dextent(r.geom)))
  from public.regions r where r.code=(select s.value #>> '{}' from public.system_settings s where s.key='pilot_region_code')
$$;

revoke all on function public.claim_firms_pipeline(uuid,integer) from public, anon, authenticated;
revoke all on function public.renew_firms_pipeline(uuid,uuid,integer) from public, anon, authenticated;
revoke all on function public.finish_firms_pipeline(uuid,uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.upsert_firms_hotspots(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.reconcile_firms_incidents(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.get_firms_cluster_inputs(uuid) from public, anon, authenticated;
revoke all on function public.get_firms_pilot_bbox() from public, anon, authenticated;
grant execute on function public.claim_firms_pipeline(uuid,integer) to service_role;
grant execute on function public.renew_firms_pipeline(uuid,uuid,integer) to service_role;
grant execute on function public.finish_firms_pipeline(uuid,uuid,text,integer,text) to service_role;
grant execute on function public.upsert_firms_hotspots(uuid,uuid,jsonb) to service_role;
grant execute on function public.reconcile_firms_incidents(uuid,uuid,jsonb) to service_role;
grant execute on function public.get_firms_cluster_inputs(uuid) to service_role;
grant execute on function public.get_firms_pilot_bbox() to service_role;
