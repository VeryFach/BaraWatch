-- Link every geolocated citizen report to one operational incident.
-- A report joins an open incident within 2 km; otherwise it starts a report incident.
create or replace function public.link_report_to_incident(
  p_report_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  report_row public.reports;
  linked_incident_id uuid;
  report_point extensions.geometry;
begin
  if p_report_id is null
     or p_latitude is null or p_latitude not between -90 and 90
     or p_longitude is null or p_longitude not between -180 and 180 then
    raise exception 'invalid report coordinates' using errcode = '22023';
  end if;

  select *
    into report_row
    from public.reports
   where id = p_report_id
   for update;
  if report_row.id is null then
    raise exception 'report_not_found' using errcode = 'P0002';
  end if;
  if report_row.incident_id is not null then
    return report_row.incident_id;
  end if;

  report_point := extensions.st_setsrid(
    extensions.st_makepoint(p_longitude, p_latitude), 4326
  );

  select i.id
    into linked_incident_id
    from public.incidents i
   where i.status in ('new', 'confirmed', 'escalated', 'in_progress', 'contained')
     and i.centroid is not null
     and (report_row.region_id is null or i.region_id is null
          or i.region_id = report_row.region_id)
     and extensions.st_dwithin(i.centroid::extensions.geography,
                               report_point::extensions.geography, 2000)
   order by extensions.st_distance(i.centroid::extensions.geography,
                                   report_point::extensions.geography),
            i.last_detected_at desc
   limit 1
   for update;

  if linked_incident_id is null then
    insert into public.incidents (
      region_id, source, status, centroid, hotspot_count,
      first_detected_at, last_detected_at
    )
    values (
      report_row.region_id, 'report', 'new', report_point, 0,
      coalesce(report_row.observed_at, report_row.created_at),
      coalesce(report_row.observed_at, report_row.created_at)
    )
    returning id into linked_incident_id;
  else
    update public.incidents
       set source = case when source = 'satellite' then 'both' else source end,
           last_detected_at = greatest(last_detected_at,
             coalesce(report_row.observed_at, report_row.created_at)),
           updated_at = now()
     where id = linked_incident_id;
  end if;

  update public.reports
     set incident_id = linked_incident_id,
         updated_at = now()
   where id = p_report_id;

  return linked_incident_id;
end;
$$;

revoke all on function public.link_report_to_incident(uuid, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.link_report_to_incident(uuid, double precision, double precision)
  to service_role;
