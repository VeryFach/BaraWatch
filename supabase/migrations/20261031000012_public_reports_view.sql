-- Public report projection with coordinates derived from the PostGIS point.
create or replace view public.public_reports as
select
  id,
  incident_id,
  matched_hotspot_id,
  extensions.st_y(geom)::numeric as latitude,
  extensions.st_x(geom)::numeric as longitude,
  observed_at,
  description,
  status,
  verification_outcome,
  verification_score,
  created_at,
  updated_at,
  region_id
from public.reports;
