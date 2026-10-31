-- BaraWatch · 0008 · Trigger integritas dan fungsi spasial

-- 1) Insiden: naikkan version dan updated_at pada setiap UPDATE (optimistic locking, BW-F-14-03).
--    Aplikasi mengubah dengan "... WHERE id = $1 AND version = $2"; 0 baris terubah = ada konflik.
create or replace function public.incidents_bump_version()
returns trigger
language plpgsql
as $$
begin
  new.version    := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger incidents_bump_version
  before update on public.incidents
  for each row execute function public.incidents_bump_version();

-- 2) Penilaian MPA bersifat append-only.
--    Insert baru menandai penilaian lama pasangan (insiden, kontak) menjadi is_current = false.
--    Satu-satunya UPDATE yang diizinkan: is_current true -> false. DELETE ditolak.
create or replace function public.assessments_supersede()
returns trigger
language plpgsql
as $$
begin
  update public.assessments
     set is_current = false
   where incident_id = new.incident_id
     and contact_id  = new.contact_id
     and is_current;
  new.is_current := true;
  return new;
end;
$$;

create trigger assessments_supersede
  before insert on public.assessments
  for each row execute function public.assessments_supersede();

create or replace function public.assessments_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'assessments bersifat append-only: DELETE ditolak';
  end if;
  if old.is_current is true and new.is_current is false
     and (new.id, new.incident_id, new.contact_id, new.verdict, new.created_at)
         is not distinct from (old.id, old.incident_id, old.contact_id, old.verdict, old.created_at) then
    return new;
  end if;
  raise exception 'assessments bersifat append-only: hanya is_current true -> false yang boleh diubah';
end;
$$;

create trigger assessments_guard
  before update or delete on public.assessments
  for each row execute function public.assessments_guard();

-- 3) Log audit tidak boleh diubah atau dihapus (service_role pun terkena trigger ini).
create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs bersifat append-only';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- 4) Anotasi hotspot satu batch (dipanggil Next.js setelah upsert hotspot, via RPC dengan service_role).
--    Mengisi region_id (desa), in_peat, heat_zone_id, lalu filter_status:
--      outside_pilot > non_wildfire_zone > low_confidence > kept
--    Ambang confidence dibaca dari system_settings.confidence_min ('low'|'nominal'|'high', default 'nominal').
create or replace function public.annotate_hotspots(p_run_id uuid)
returns table (filter_status text, total bigint)
language plpgsql
set search_path = public, extensions
as $$
declare
  v_min text;
  v_min_rank int;
begin
  select coalesce(value #>> '{}', 'nominal') into v_min
    from public.system_settings where key = 'confidence_min';
  v_min := coalesce(v_min, 'nominal');
  v_min_rank := case v_min when 'high' then 3 when 'nominal' then 2 else 1 end;

  -- Desa: pilih satu secara deterministik bila titik tepat di perbatasan.
  update public.hotspots h
     set region_id = (
           select r.id from public.regions r
            where r.level = 'desa' and st_covers(r.geom, h.geom)
            order by r.code limit 1)
   where h.ingest_run_id = p_run_id and h.filter_status = 'pending';

  update public.hotspots h
     set in_peat = exists (select 1 from public.peat_areas p where st_intersects(p.geom, h.geom))
   where h.ingest_run_id = p_run_id and h.filter_status = 'pending';

  update public.hotspots h
     set heat_zone_id = (
           select z.id from public.heat_source_zones z
            where st_intersects(z.geom, h.geom)
            order by z.id limit 1)
   where h.ingest_run_id = p_run_id and h.filter_status = 'pending';

  update public.hotspots h
     set filter_status = case
           when h.region_id is null        then 'outside_pilot'
           when h.heat_zone_id is not null then 'non_wildfire_zone'
           when case h.confidence_level when 'high' then 3 when 'nominal' then 2 else 1 end < v_min_rank
                                           then 'low_confidence'
           else 'kept'
         end
   where h.ingest_run_id = p_run_id and h.filter_status = 'pending';

  return query
    select h.filter_status, count(*)
      from public.hotspots h
     where h.ingest_run_id = p_run_id
     group by h.filter_status;
end;
$$;

-- Fungsi di schema public otomatis bisa dipanggil lewat API; batasi ke service_role.
revoke execute on function public.annotate_hotspots(uuid) from public, anon, authenticated;
grant  execute on function public.annotate_hotspots(uuid) to service_role;
