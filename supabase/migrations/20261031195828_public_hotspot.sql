create or replace function public.get_public_hotspots(
  p_lat double precision default null,
  p_lon double precision default null,
  p_radius_m integer default null,
  p_region_id uuid default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  latitude numeric,
  longitude numeric,
  acq_at timestamptz,
  satellite text,
  instrument text,
  confidence_level text,
  frp numeric,
  in_peat boolean,
  region_id uuid,
  region_code text,
  region_name text,
  region_district text,
  incident_id uuid
)
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  select
    h.id,
    h.latitude,
    h.longitude,
    h.acq_at,
    h.satellite,
    h.instrument,
    h.confidence_level,
    h.frp,
    h.in_peat,
    h.region_id,
    r.code,
    r.name,
    district.name,
    h.incident_id
  from public.public_hotspots_v h
  left join public.regions r on r.id = h.region_id
  left join public.regions district on district.id = r.parent_id
  where (p_region_id is null or h.region_id = p_region_id)
    and (
      p_lat is null
      or (
        p_lon is not null
        and p_radius_m is not null
        and extensions.st_dwithin(
          h.geom::extensions.geography,
          extensions.st_setsrid(extensions.st_makepoint(p_lon, p_lat), 4326)::extensions.geography,
          p_radius_m
        )
      )
    )
  order by h.acq_at desc, h.id
  limit greatest(1, least(coalesce(p_limit, 100), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.get_public_hotspots(double precision, double precision, integer, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_hotspots(double precision, double precision, integer, uuid, integer, integer)
  to anon, authenticated, service_role;

grant select on public.public_regions to anon, authenticated;
