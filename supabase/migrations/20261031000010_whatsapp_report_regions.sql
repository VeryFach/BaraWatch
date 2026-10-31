alter table public.reports
  add column if not exists region_id uuid references public.regions(id) on delete set null;

create index if not exists reports_region_idx on public.reports (region_id);

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
  limit 1
$$;
