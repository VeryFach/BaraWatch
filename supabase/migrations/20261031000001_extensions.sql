-- BaraWatch · 0001 · Ekstensi
-- Semua ekstensi dipasang di schema `extensions` (konvensi Supabase) agar tabel
-- spasial bawaan (spatial_ref_sys) tidak ikut terbuka lewat API di schema public.
-- search_path default Supabase sudah memuat `extensions`.

create schema if not exists extensions;

create extension if not exists postgis with schema extensions;   -- geometry, ST_*
create extension if not exists pg_trgm with schema extensions;   -- pencarian nama desa yang mirip (BW-F-1-01)
create extension if not exists ltree   with schema extensions;   -- hierarki wilayah
create extension if not exists vector  with schema extensions;   -- RAG chatbot (fase 3)

-- Fungsi umum: perbarui updated_at pada setiap UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
