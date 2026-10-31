-- BaraWatch · 0003 · Akun dashboard, pipeline, parameter, versi model
-- Hanya tiga peran dashboard. Warga dan MPA tidak punya akun (lihat tabel contacts).

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  role       text not null check (role in ('petugas','penegak_hukum','admin')),
  agency     text,                          -- BPBD / Manggala Agni / TNI / Polri / regulator
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Cakupan wilayah akun (BW-F-24-02). Wilayah di tingkat atas mencakup semua turunannya (lewat ltree).
create table public.profile_regions (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  region_id  uuid not null references public.regions(id)  on delete cascade,
  primary key (profile_id, region_id)
);
create index profile_regions_region_idx on public.profile_regions (region_id);

create table public.pipeline_runs (
  id              uuid primary key default gen_random_uuid(),
  job_name        text not null check (job_name in ('firms','support_data','radd','weekly_risk','retrain')),
  trigger_type    text not null check (trigger_type in ('schedule','manual')),
  triggered_by    uuid references public.profiles(id) on delete set null,
  status          text not null default 'running' check (status in ('running','success','partial','failed')),
  records_fetched integer,
  quota_remaining integer,                  -- sisa kuota API sumber (BW-F-25-01)
  error           text,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);
create index pipeline_runs_job_started_idx on public.pipeline_runs (job_name, started_at desc);

-- Parameter yang bisa diubah admin tanpa deploy ulang (BW-F-21). Nilai awal: supabase/seed.sql.
create table public.system_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Registri versi model AI (BW-F-23). Satu versi aktif per jenis model; aktivasi butuh persetujuan admin.
create table public.model_versions (
  id            uuid primary key default gen_random_uuid(),
  model_type    text not null check (model_type in ('yolo_fire_smoke','xgboost_risk')),
  version       text not null,
  artifact_path text,                       -- lokasi bobot di Storage
  metrics       jsonb not null default '{}'::jsonb,
  status        text not null default 'candidate' check (status in ('candidate','active','archived')),
  label_count   integer,
  trained_at    timestamptz,
  approved_by   uuid references public.profiles(id) on delete set null,
  approved_at   timestamptz,
  activated_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (model_type, version),
  constraint model_active_requires_approval
    check (status <> 'active' or (approved_by is not null and approved_at is not null))
);
create unique index model_versions_one_active_idx on public.model_versions (model_type) where status = 'active';
