-- Keep the existing public incident view and add numeric coordinates so
-- PostgREST does not serialize the centroid as EWKB for the map consumer.
create or replace view public.public_incidents_v as
select i.id,
       i.region_id,
       r.code as region_code,
       r.name as region_name,
       i.source,
       i.status,
       i.hotspot_count,
       i.centroid,
       i.first_detected_at,
       i.last_detected_at,
       i.closed_at,
       extensions.st_y(i.centroid)::double precision as latitude,
       extensions.st_x(i.centroid)::double precision as longitude
  from public.incidents i
  left join public.regions r on r.id = i.region_id
 where i.status <> 'false_alarm';
