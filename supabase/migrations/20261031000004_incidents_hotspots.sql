-- BaraWatch · 0004 · Kontak, insiden, hotspot

-- Warga dan MPA (identitas WhatsApp, tanpa akun). contacts.id dipakai sebagai pseudonim di tabel lain.
create table public.contacts (
  id                 uuid primary key default gen_random_uuid(),
  phone_e164         text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  role               text not null default 'warga' check (role in ('warga','mpa')),
  assigned_region_id uuid references public.regions(id) on delete set null,   -- desa tugas MPA
  consent_at         timestamptz,
  opted_out_at       timestamptz,
  last_inbound_at    timestamptz,           -- menentukan jendela 24 jam: teks bebas vs template wajib
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint contacts_mpa_has_region check (role <> 'mpa' or assigned_region_id is not null)
);
create index contacts_region_idx on public.contacts (assigned_region_id);
create trigger contacts_set_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Insiden = hasil pengelompokan hotspot dan/atau laporan warga.
-- Status hanya satu kolom; perpindahannya lewat state machine di aplikasi (modules/incidents).
create table public.incidents (
  id               uuid primary key default gen_random_uuid(),
  region_id        uuid references public.regions(id) on delete set null,   -- desa dominan
  source           text not null check (source in ('satellite','report','both')),
  status           text not null default 'new' check (status in
                     ('new','confirmed','false_alarm','escalated','in_progress','contained','extinguished','closed')),
  needs_review     boolean not null default false,        -- penilaian MPA berkonflik (BW-F-8-03)
  priority_score   integer not null default 0,
  centroid         extensions.geometry(Point, 4326),
  footprint        extensions.geometry(Geometry, 4326),   -- convex hull klaster
  hotspot_count    integer not null default 0,
  reopened_count   integer not null default 0,
  version          integer not null default 1,            -- optimistic locking (BW-F-14-03)
  first_detected_at timestamptz not null default now(),
  last_detected_at  timestamptz not null default now(),
  closed_at        timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index incidents_region_idx    on public.incidents (region_id);
create index incidents_status_idx    on public.incidents (status, last_detected_at desc);
create index incidents_centroid_gix  on public.incidents using gist (centroid);
create index incidents_footprint_gix on public.incidents using gist (footprint);
create index incidents_review_idx    on public.incidents (needs_review) where needs_review;

create table public.incident_status_logs (
  id                 uuid primary key default gen_random_uuid(),
  incident_id        uuid not null references public.incidents(id) on delete cascade,
  from_status        text,
  to_status          text not null,
  changed_by_profile uuid references public.profiles(id) on delete set null,
  changed_by_contact uuid references public.contacts(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now(),
  constraint status_log_single_actor check (num_nonnulls(changed_by_profile, changed_by_contact) <= 1)
);
create index incident_status_logs_incident_idx on public.incident_status_logs (incident_id, created_at);

-- Hotspot FIRMS. Koordinat disimpan sebagai angka mentah agar kunci dedupe jelas;
-- geom dihasilkan otomatis. Waktu acq_at dalam UTC.
create table public.hotspots (
  id               uuid primary key default gen_random_uuid(),
  ingest_run_id    uuid references public.pipeline_runs(id) on delete set null,
  region_id        uuid references public.regions(id) on delete set null,
  incident_id      uuid references public.incidents(id) on delete set null,
  heat_zone_id     uuid references public.heat_source_zones(id) on delete set null,
  latitude         numeric(8,5) not null,
  longitude        numeric(8,5) not null,
  geom             extensions.geometry(Point, 4326)
                     generated always as (extensions.st_setsrid(extensions.st_makepoint(longitude::float8, latitude::float8), 4326)) stored,
  acq_at           timestamptz not null,
  satellite        text not null,
  instrument       text not null,                 -- VIIRS / MODIS
  source_product   text,                          -- mis. VIIRS_NOAA20_NRT
  confidence_raw   text,                          -- VIIRS: l/n/h; MODIS: 0-100
  confidence_level text check (confidence_level in ('low','nominal','high')),
  frp              numeric(10,2),                 -- MW
  brightness       numeric(7,2),                  -- bright_ti4 (VIIRS) / brightness (MODIS)
  daynight         text check (daynight in ('D','N')),
  in_peat          boolean not null default false,
  filter_status    text not null default 'pending' check (filter_status in
                     ('pending','kept','low_confidence','non_wildfire_zone','outside_pilot')),
  ingested_at      timestamptz not null default now(),   -- awal hitungan KPI latensi
  unique (satellite, instrument, acq_at, latitude, longitude)   -- tanpa duplikat (BW-F-25-02)
);
create index hotspots_geom_gix      on public.hotspots using gist (geom);
create index hotspots_acq_at_idx    on public.hotspots (acq_at desc);
create index hotspots_region_idx    on public.hotspots (region_id);
create index hotspots_incident_idx  on public.hotspots (incident_id);
create index hotspots_run_idx       on public.hotspots (ingest_run_id);
create index hotspots_unclustered_idx on public.hotspots (acq_at)
  where incident_id is null and filter_status = 'kept';
