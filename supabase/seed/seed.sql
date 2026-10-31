-- BaraWatch · seed · Parameter awal (BW-F-21)
-- Semua nilai di bawah adalah titik awal untuk dikalibrasi dengan data historis,
-- bukan nilai yang sudah teruji. Admin dapat mengubahnya lewat dashboard.

insert into public.system_settings (key, value) values
  ('pilot_region_code',      '"62"'),                       -- Kalimantan Tengah (kode Kemendagri)
  ('firms_interval_minutes', '30'),
  ('firms_products',         '["VIIRS_SNPP_NRT","VIIRS_NOAA20_NRT","VIIRS_NOAA21_NRT","MODIS_NRT"]'),
  ('confidence_min',         '"nominal"'),                  -- low | nominal | high; dipakai annotate_hotspots()
  ('dbscan_eps_km',          '1.0'),                        -- piksel VIIRS 375 m, MODIS 1 km
  ('dbscan_min_samples',     '2'),
  ('cluster_window_hours',   '24'),
  ('reopen_window_hours',    '24')                          -- BW-F-15-01
on conflict (key) do nothing;
