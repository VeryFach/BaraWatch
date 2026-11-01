create or replace function public.region_test_point(p_region_id uuid)
returns table (latitude double precision, longitude double precision)
language sql
security definer
set search_path = public, extensions
as $$
  select
    extensions.st_y(extensions.st_pointonsurface(r.geom))::double precision,
    extensions.st_x(extensions.st_pointonsurface(r.geom))::double precision
  from public.regions r
  where r.id = p_region_id
    and r.level = 'desa'
  limit 1;
$$;

revoke all on function public.region_test_point(uuid)
  from public, anon, authenticated;
grant execute on function public.region_test_point(uuid) to service_role;
