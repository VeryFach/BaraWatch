-- BaraWatch · 0002 · Layer spasial referensi
-- Dimuat lewat scripts/geo-etl (schema staging -> validasi -> tabel final),
-- bukan lewat cron. Semua geometri EPSG:4326. Untuk jarak/luas dalam meter, cast ke geography.

-- Catatan asal-usul tiap layer (sumber, versi, lisensi).
create table public.layer_sources (
  id            uuid primary key default gen_random_uuid(),
  layer         text not null check (layer in
                  ('regions','peat_areas','heat_source_zones','concessions','water_sources','radd_alerts')),
  source_name   text not null,
  version       text,                       -- tahun/edisi sumber
  license       text,
  source_url    text,
  downloaded_at timestamptz,
  checksum      text,
  notes         text,
  created_at    timestamptz not null default now()
);

-- Hierarki wilayah satu tabel: provinsi > kabupaten > kecamatan > desa.
create table public.regions (
  id           uuid primary key default gen_random_uuid(),
  parent_id    uuid references public.regions(id) on delete restrict,
  level        text not null check (level in ('provinsi','kabupaten','kecamatan','desa')),
  code         text not null unique,        -- kode Kemendagri, mis. 62 (Kalimantan Tengah)
  name         text not null,
  path         extensions.ltree not null,   -- jalur dari provinsi; dipakai untuk "desa di bawah kecamatan X"
  geom         extensions.geometry(MultiPolygon, 4326) not null,
  geom_display extensions.geometry(MultiPolygon, 4326),   -- versi disederhanakan untuk peta
  area_ha      numeric(14,2),
  peat_ratio   numeric(5,4) check (peat_ratio between 0 and 1),
  is_pilot     boolean not null default false,
  source_id    uuid references public.layer_sources(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint regions_root_has_no_parent check ((level = 'provinsi') = (parent_id is null))
);
create index regions_geom_gix         on public.regions using gist (geom);
create index regions_path_gix         on public.regions using gist (path);
create index regions_parent_idx       on public.regions (parent_id);
create index regions_level_idx        on public.regions (level);
create index regions_name_trgm_idx    on public.regions using gin (name extensions.gin_trgm_ops);
create trigger regions_set_updated_at before update on public.regions
  for each row execute function public.set_updated_at();

create table public.peat_areas (
  id          uuid primary key default gen_random_uuid(),
  depth_class text,
  geom        extensions.geometry(MultiPolygon, 4326) not null,
  source_id   uuid references public.layer_sources(id),
  created_at  timestamptz not null default now()
);
create index peat_areas_geom_gix on public.peat_areas using gist (geom);

-- Sumber panas non-karhutla (industri, tambang, dst.) untuk menyaring hotspot (BW-F-26).
create table public.heat_source_zones (
  id         uuid primary key default gen_random_uuid(),
  zone_type  text not null check (zone_type in ('industri','tambang','pembangkit','flare','gunung_api','lainnya')),
  name       text,
  geom       extensions.geometry(MultiPolygon, 4326) not null,   -- sudah diberi buffer ±1 piksel hotspot
  source_id  uuid references public.layer_sources(id),
  created_at timestamptz not null default now()
);
create index heat_source_zones_geom_gix on public.heat_source_zones using gist (geom);

-- Konsesi: hanya untuk Penegak Hukum (lihat RLS). Pastikan data diperoleh secara sah (BW-F-18).
create table public.concessions (
  id              uuid primary key default gen_random_uuid(),
  holder_name     text,
  concession_type text,
  geom            extensions.geometry(MultiPolygon, 4326) not null,
  source_id       uuid references public.layer_sources(id),
  created_at      timestamptz not null default now()
);
create index concessions_geom_gix on public.concessions using gist (geom);

create table public.water_sources (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid references public.regions(id) on delete set null,
  type       text,
  name       text,
  geom       extensions.geometry(Point, 4326) not null,
  source_id  uuid references public.layer_sources(id),
  created_at timestamptz not null default now()
);
create index water_sources_geom_gix   on public.water_sources using gist (geom);
create index water_sources_region_idx on public.water_sources (region_id);
