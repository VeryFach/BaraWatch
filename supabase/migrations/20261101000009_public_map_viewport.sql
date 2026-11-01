create or replace function public.get_public_regions_in_bbox(
  west double precision,
  south double precision,
  east double precision,
  north double precision
)
returns table (
  id uuid,
  parent_id uuid,
  level text,
  code text,
  name text,
  geometry jsonb
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select r.id, r.parent_id, r.level, r.code, r.name,
         extensions.st_asgeojson(r.geom)::jsonb
  from public.regions r
  where r.geom && extensions.st_makeenvelope(west, south, east, north, 4326)
    and extensions.st_intersects(
      r.geom,
      extensions.st_makeenvelope(west, south, east, north, 4326)
    )
  order by r.code;
$$;

grant execute on function public.get_public_regions_in_bbox(double precision, double precision, double precision, double precision)
  to anon, authenticated;