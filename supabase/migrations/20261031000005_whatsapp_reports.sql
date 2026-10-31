-- BaraWatch · 0005 · WhatsApp, laporan warga, penilaian, eskalasi, label

create table public.subscriptions (
  id         uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  region_id  uuid not null references public.regions(id)  on delete cascade,   -- desa atau kecamatan
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index subscriptions_active_uq on public.subscriptions (contact_id, region_id) where is_active;
create index subscriptions_region_idx on public.subscriptions (region_id) where is_active;

-- State percakapan singkat bot (mis. menunggu lokasi, BW-F-5-01).
create table public.wa_sessions (
  contact_id uuid primary key references public.contacts(id) on delete cascade,
  state      text not null default 'idle',
  context    jsonb not null default '{}'::jsonb,
  expires_at timestamptz
);

-- Laporan warga (fase 2).
create table public.reports (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid not null references public.contacts(id) on delete restrict,
  incident_id         uuid references public.incidents(id) on delete set null,
  duplicate_of        uuid references public.reports(id)   on delete set null,     -- laporan kembar (BW-F-5-03)
  matched_hotspot_id  uuid references public.hotspots(id)  on delete set null,
  geom                extensions.geometry(Point, 4326),                            -- null sampai lokasi dikirim
  observed_at         timestamptz,
  description         text,
  status              text not null default 'received' check (status in
                        ('received','in_review','verified','handled','rejected')),
  verification_outcome text check (verification_outcome in ('auto_pass','uncertain','rejected')),
  verification_score  numeric(5,4) check (verification_score between 0 and 1),
  match_distance_m    numeric(10,1),
  match_dt_minutes    integer,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index reports_incident_idx on public.reports (incident_id);
create index reports_contact_idx  on public.reports (contact_id);
create index reports_geom_gix     on public.reports using gist (geom);
create index reports_review_idx   on public.reports (created_at) where verification_outcome = 'uncertain';
create trigger reports_set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

create table public.report_media (
  id               uuid primary key default gen_random_uuid(),
  report_id        uuid not null references public.reports(id) on delete cascade,
  storage_path     text not null,                 -- Supabase Storage (bukan URL Twilio)
  media_type       text not null check (media_type in ('image','video')),
  frames_analyzed  integer,
  fire_score       numeric(5,4) check (fire_score  between 0 and 1),
  smoke_score      numeric(5,4) check (smoke_score between 0 and 1),
  detections       jsonb,
  model_version_id uuid references public.model_versions(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index report_media_report_idx on public.report_media (report_id);

-- Log pesan sekaligus outbox. Baris keluar dibuat 'queued', dikirim dispatcher,
-- lalu diperbarui oleh callback Twilio.
create table public.wa_messages (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  direction     text not null check (direction in ('in','out')),
  kind          text not null check (kind in
                  ('alert','update','risk_weekly','report_status','escalation','chat')),
  provider_sid  text unique,                      -- Twilio MessageSid; kunci idempotensi webhook
  dedupe_key    text unique,                      -- insiden+kontak+kind+versi
  template_name text,
  body          text,
  media_path    text,
  lat           numeric(8,5),
  lng           numeric(8,5),
  status        text not null default 'queued' check (status in
                  ('received','queued','sent','delivered','read','failed')),
  error_code    text,
  attempts      integer not null default 0,
  next_retry_at timestamptz,
  incident_id   uuid references public.incidents(id) on delete set null,
  report_id     uuid references public.reports(id)   on delete set null,
  handed_off_at timestamptz,                      -- diterima Twilio; akhir hitungan KPI latensi P95 <= 5 menit
  delivered_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index wa_messages_contact_idx on public.wa_messages (contact_id, created_at desc);
create index wa_messages_incident_idx on public.wa_messages (incident_id);
create index wa_messages_outbox_idx on public.wa_messages (next_retry_at nulls first)
  where direction = 'out' and status in ('queued','failed');

-- Penilaian MPA: append-only (trigger di migrasi 8). is_current = penilaian terbaru per (insiden, kontak).
create table public.assessments (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  contact_id  uuid not null references public.contacts(id)  on delete restrict,
  verdict     text not null check (verdict in ('real_fire','not_fire')),
  is_current  boolean not null default true,
  created_at  timestamptz not null default now()
);
create unique index assessments_current_uq on public.assessments (incident_id, contact_id) where is_current;
create index assessments_incident_idx on public.assessments (incident_id);

create table public.escalations (
  id                  uuid primary key default gen_random_uuid(),
  incident_id         uuid not null references public.incidents(id) on delete cascade,
  escalated_by        uuid not null references public.contacts(id)  on delete restrict,
  acknowledged_by     uuid references public.profiles(id) on delete set null,
  summary             jsonb not null default '{}'::jsonb,     -- lokasi, foto, status
  no_officer_fallback boolean not null default false,         -- tidak ada petugas terdaftar (BW-F-9-03)
  escalated_at        timestamptz not null default now(),
  acknowledged_at     timestamptz
);
create index escalations_incident_idx on public.escalations (incident_id);

-- Label akhir oleh admin; bahan latih model (BW-F-22). Tepat satu dari incident_id / report_id.
create table public.training_labels (
  id          uuid primary key default gen_random_uuid(),
  incident_id uuid references public.incidents(id) on delete cascade,
  report_id   uuid references public.reports(id)   on delete cascade,
  label       text not null check (label in ('valid','invalid','not_fire')),
  source      text not null check (source in ('admin','mpa_consensus')),
  labeled_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint training_labels_one_subject check (num_nonnulls(incident_id, report_id) = 1)
);
create index training_labels_incident_idx on public.training_labels (incident_id);
create index training_labels_report_idx   on public.training_labels (report_id);
