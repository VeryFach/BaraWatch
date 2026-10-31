-- BaraWatch · 0011 · Assign report region from report geometry

create or replace function public.region_for_point(latitude numeric, longitude numeric)
returns table (region_id uuid, region_name text)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select r.id, r.name
    from public.regions r
   where r.level = 'desa'
     and extensions.st_covers(
       r.geom,
       extensions.st_setsrid(extensions.st_makepoint(longitude, latitude), 4326)
     )
   order by r.code
   limit 1
$$;

create or replace function public.assign_report_region()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.geom is null then
    new.region_id := null;
    return new;
  end if;

  -- st_covers includes points on a boundary. The code order makes a
  -- boundary match deterministic when polygons overlap at their edge.
  select r.id
    into new.region_id
    from public.regions r
   where r.level = 'desa'
     and extensions.st_covers(r.geom, new.geom)
   order by r.code
   limit 1;

  return new;
end;
$$;

drop trigger if exists reports_assign_region on public.reports;

create trigger reports_assign_region
  before insert or update of geom on public.reports
  for each row
  execute function public.assign_report_region();

revoke execute on function public.assign_report_region() from public, anon, authenticated;
grant execute on function public.assign_report_region() to service_role;
