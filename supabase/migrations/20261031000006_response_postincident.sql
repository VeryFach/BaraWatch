-- BaraWatch · 0006 · Penanganan, pasca-kejadian, RADD, risiko, audit

-- Tim/regu: ada di UI proposal tetapi belum punya kode BW-F. Opsional, fase lanjutan.
create table public.response_teams (
  id             uuid primary key default gen_random_uuid(),
  base_region_id uuid references public.regions(id) on delete set null,
  name           text not null,
  agency         text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table public.incident_assignments (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id)      on delete cascade,
  team_id     uuid not null references public.response_teams(id) on delete restrict,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  released_at timestamptz
);
create index incident_assignments_incident_idx on public.incident_assignments (incident_id);

-- Estimasi luas area terbakar (dNBR). Selalu tampilkan is_uncertain dan tanggal citra (BW-F-16).
create table public.burn_area_reports (
  id                uuid primary key default gen_random_uuid(),
  incident_id       uuid not null references public.incidents(id) on delete cascade,
  area_ha           numeric(12,2) not null,
  geom              extensions.geometry(MultiPolygon, 4326),
  method            text not null default 'dnbr' check (method in ('dnbr','radar')),
  image_before_date date,
  image_after_date  date,
  cloud_cover_pct   numeric(5,2) check (cloud_cover_pct between 0 and 100),
  is_uncertain      boolean not null default false,
  computed_at       timestamptz not null default now()
);
create index burn_area_reports_incident_idx on public.burn_area_reports (incident_id);
create index burn_area_reports_geom_gix on public.burn_area_reports using gist (geom);

-- Catatan telaah penegak hukum (BW-F-19). Wajib memuat disclaimer "bukan bukti hukum final".
create table public.legal_review_notes (
  id                  uuid primary key default gen_random_uuid(),
  incident_id         uuid not null references public.incidents(id) on delete cascade,
  burn_area_report_id uuid references public.burn_area_reports(id) on delete set null,
  author_id           uuid not null references public.profiles(id) on delete restrict,
  findings            text not null,
  concession_overlap  jsonb not null default '[]'::jsonb,   -- snapshot: id konsesi + luas irisan
  radd_alert_count    integer,
  disclaimer_included boolean not null default true,
  exported_at         timestamptz,
  created_at          timestamptz not null default now(),
  constraint legal_notes_disclaimer_required check (disclaimer_included)
);
create index legal_review_notes_incident_idx on public.legal_review_notes (incident_id);

-- Alert RADD (indikasi kehilangan tutupan pohon) dalam bentuk poligon. Bukan masukan DBSCAN.
create table public.radd_alerts (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid references public.regions(id) on delete set null,
  alert_date date not null,
  confidence text check (confidence in ('low','high')),
  area_ha    numeric(10,2),
  geom       extensions.geometry(MultiPolygon, 4326) not null,
  source_key text unique,                 -- kunci dari FastAPI agar job mingguan idempotent
  source_id  uuid references public.layer_sources(id),
  created_at timestamptz not null default now()
);
create index radd_alerts_geom_gix on public.radd_alerts using gist (geom);
create index radd_alerts_region_date_idx on public.radd_alerts (region_id, alert_date desc);

-- Fitur mingguan per desa untuk skor risiko (BW-F-27).
create table public.region_weekly_features (
  region_id        uuid not null references public.regions(id) on delete cascade,
  week_start       date not null,
  rainfall_mm      numeric(8,2),
  dry_days         integer,
  soil_moisture    numeric(6,4),
  enso_idx         numeric(6,3),
  iod_idx          numeric(6,3),
  hotspot_count_7d integer,
  radd_area_ha_28d numeric(10,2),
  primary key (region_id, week_start)
);

create table public.risk_scores (
  id               uuid primary key default gen_random_uuid(),
  region_id        uuid not null references public.regions(id) on delete cascade,
  week_start       date not null,
  method           text not null check (method in ('rule_based','xgboost')),
  level            text not null check (level in ('rendah','sedang','tinggi','ekstrem')),
  score            numeric(6,3),
  top_reasons      jsonb not null default '[]'::jsonb,       -- alasan utama (BW-F-28-01)
  model_version_id uuid references public.model_versions(id) on delete set null,
  computed_at      timestamptz not null default now(),
  unique (region_id, week_start, method)
);
create index risk_scores_week_idx on public.risk_scores (week_start desc, level);

-- Log audit: akses konsesi, akses ditolak, perubahan akun (BW-F-17-02, 18-02, 24-03). Tidak bisa diubah.
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  outcome     text not null check (outcome in ('allowed','denied')),
  metadata    jsonb not null default '{}'::jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx  on public.audit_logs (actor_id, created_at desc);
