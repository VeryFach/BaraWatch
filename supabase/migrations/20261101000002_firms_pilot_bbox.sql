-- Provide the FIRMS adapter with the configured Kalimantan Tengah pilot area.
-- This is a system setting; no new table or data model is introduced.
insert into public.system_settings (key, value)
values ('firms_pilot_bbox', '[111.0, -4.0, 116.0, -0.5]'::jsonb)
on conflict (key) do nothing;
