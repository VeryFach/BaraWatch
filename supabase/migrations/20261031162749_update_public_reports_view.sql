create or replace view public.public_regions as
select
  id,
  parent_id,
  level,
  code,
  name,
  extensions.st_asgeojson(geom)::jsonb as geometry
from public.regions;