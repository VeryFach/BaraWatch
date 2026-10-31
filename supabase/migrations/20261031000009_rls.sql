-- BaraWatch · 0009 · Row Level Security, fungsi peran, view publik
--
-- Prinsip:
--  * Semua tabel RLS aktif. Tanpa policy = hanya service_role yang bisa akses
--    (cron, webhook WhatsApp, pemanggilan FastAPI lewat Next.js server).
--  * Dashboard memakai klien sesi pengguna sehingga policy di bawah berlaku.
--  * Admin mewarisi Petugas. Penegak Hukum TIDAK mewarisi apa pun, dan sebaliknya
--    Admin/Petugas tidak mendapat akses konsesi maupun catatan telaah hukum.
--  * Role anon tidak membaca tabel apa pun; data publik hanya lewat view public_*_v.

-- ---------- Fungsi peran ----------

create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() = 'admin', false) $$;

-- Petugas atau Admin (Admin mewarisi fungsi Petugas).
create or replace function public.is_ops() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() in ('petugas','admin'), false) $$;

create or replace function public.is_legal() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() = 'penegak_hukum', false) $$;

-- Apakah wilayah target berada dalam cakupan akun (wilayah itu sendiri atau turunannya).
create or replace function public.region_in_scope(target uuid)
returns boolean
language sql stable security definer
set search_path = public, extensions
as $$
  select case public.current_app_role()
    when 'admin' then true
    when 'petugas' then exists (
      select 1
        from public.profile_regions pr
        join public.regions scope_r on scope_r.id = pr.region_id
        join public.regions t       on t.id = target
       where pr.profile_id = auth.uid()
         and t.path <@ scope_r.path)
    else false
  end
$$;

revoke execute on function
  public.current_app_role(), public.is_admin(), public.is_ops(), public.is_legal(), public.region_in_scope(uuid)
  from public, anon;
grant execute on function
  public.current_app_role(), public.is_admin(), public.is_ops(), public.is_legal(), public.region_in_scope(uuid)
  to authenticated, service_role;

-- ---------- Aktifkan RLS di semua tabel ----------

alter table public.layer_sources          enable row level security;
alter table public.regions                enable row level security;
alter table public.peat_areas             enable row level security;
alter table public.heat_source_zones      enable row level security;
alter table public.concessions            enable row level security;
alter table public.water_sources          enable row level security;
alter table public.profiles               enable row level security;
alter table public.profile_regions        enable row level security;
alter table public.pipeline_runs          enable row level security;
alter table public.system_settings        enable row level security;
alter table public.model_versions         enable row level security;
alter table public.contacts               enable row level security;
alter table public.incidents              enable row level security;
alter table public.incident_status_logs   enable row level security;
alter table public.hotspots               enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.wa_sessions            enable row level security;
alter table public.reports                enable row level security;
alter table public.report_media           enable row level security;
alter table public.wa_messages            enable row level security;
alter table public.assessments            enable row level security;
alter table public.escalations            enable row level security;
alter table public.training_labels        enable row level security;
alter table public.response_teams         enable row level security;
alter table public.incident_assignments   enable row level security;
alter table public.burn_area_reports      enable row level security;
alter table public.legal_review_notes     enable row level security;
alter table public.radd_alerts            enable row level security;
alter table public.region_weekly_features enable row level security;
alter table public.risk_scores            enable row level security;
alter table public.audit_logs             enable row level security;
alter table public.kb_documents           enable row level security;
alter table public.kb_chunks              enable row level security;

-- ---------- Referensi: dibaca semua akun aktif, ditulis admin ----------

create policy layer_sources_read on public.layer_sources for select to authenticated
  using (public.current_app_role() is not null);
create policy layer_sources_admin on public.layer_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy regions_read on public.regions for select to authenticated
  using (public.current_app_role() is not null);
create policy regions_admin on public.regions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy peat_areas_read on public.peat_areas for select to authenticated
  using (public.current_app_role() is not null);
create policy peat_areas_admin on public.peat_areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy heat_zones_read on public.heat_source_zones for select to authenticated
  using (public.current_app_role() is not null);
create policy heat_zones_admin on public.heat_source_zones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy water_sources_read on public.water_sources for select to authenticated
  using (public.current_app_role() is not null);
create policy water_sources_admin on public.water_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Konsesi: hanya Penegak Hukum membaca (akses dicatat aplikasi ke audit_logs, BW-F-18-02).
-- Data dimuat lewat service_role (geo-etl); tidak ada policy tulis.
create policy concessions_legal_read on public.concessions for select to authenticated
  using (public.is_legal());

-- ---------- Akun, pipeline, parameter, model ----------

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy profile_regions_read on public.profile_regions for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
create policy profile_regions_admin on public.profile_regions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy pipeline_runs_admin on public.pipeline_runs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy system_settings_admin on public.system_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy model_versions_admin on public.model_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy training_labels_admin on public.training_labels for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Kontak, langganan, pesan: hanya admin. wa_sessions: tanpa policy (service_role saja).
create policy contacts_admin on public.contacts for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy subscriptions_admin on public.subscriptions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy wa_messages_admin_read on public.wa_messages for select to authenticated
  using (public.is_admin());

-- ---------- Insiden dan turunannya ----------

-- Admin: semua. Petugas: wilayahnya. Penegak Hukum: hanya kejadian selesai (BW-F-17).
create policy incidents_read on public.incidents for select to authenticated
  using (
    (public.is_ops() and public.region_in_scope(region_id))
    or (public.is_legal() and status in ('extinguished','closed'))
  );
create policy incidents_ops_update on public.incidents for update to authenticated
  using      (public.is_ops() and public.region_in_scope(region_id))
  with check (public.is_ops() and public.region_in_scope(region_id));

-- Tabel di bawah ini mengikuti visibilitas insiden: subquery ke incidents tunduk pada RLS pengguna.
create policy status_logs_read on public.incident_status_logs for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = incident_status_logs.incident_id));
create policy status_logs_ops_insert on public.incident_status_logs for insert to authenticated
  with check (
    public.is_ops()
    and changed_by_profile = auth.uid()
    and exists (select 1 from public.incidents i
                 where i.id = incident_status_logs.incident_id and public.region_in_scope(i.region_id))
  );

create policy hotspots_ops_read on public.hotspots for select to authenticated
  using (public.is_ops() and public.region_in_scope(region_id));
create policy hotspots_legal_read on public.hotspots for select to authenticated
  using (public.is_legal() and incident_id is not null
         and exists (select 1 from public.incidents i where i.id = hotspots.incident_id));

create policy assessments_read on public.assessments for select to authenticated
  using (public.is_ops()
         and exists (select 1 from public.incidents i where i.id = assessments.incident_id));

create policy escalations_read on public.escalations for select to authenticated
  using (public.is_ops()
         and exists (select 1 from public.incidents i where i.id = escalations.incident_id));
create policy escalations_ack on public.escalations for update to authenticated
  using      (public.is_ops()
              and exists (select 1 from public.incidents i where i.id = escalations.incident_id))
  with check (public.is_ops() and (acknowledged_by is null or acknowledged_by = auth.uid()));

-- Laporan warga dan media: Admin semua; Petugas yang terkait insiden di wilayahnya (BW-F-5-06).
create policy reports_ops_read on public.reports for select to authenticated
  using (public.is_admin()
         or (public.is_ops() and exists (select 1 from public.incidents i where i.id = reports.incident_id)));
create policy reports_ops_update on public.reports for update to authenticated
  using      (public.is_admin()
              or (public.is_ops() and exists (select 1 from public.incidents i where i.id = reports.incident_id)))
  with check (public.is_ops());
create policy report_media_read on public.report_media for select to authenticated
  using (exists (select 1 from public.reports r where r.id = report_media.report_id));

create policy response_teams_read on public.response_teams for select to authenticated
  using (public.is_ops());
create policy response_teams_admin on public.response_teams for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy assignments_ops_read on public.incident_assignments for select to authenticated
  using (public.is_ops()
         and exists (select 1 from public.incidents i where i.id = incident_assignments.incident_id));
create policy assignments_ops_write on public.incident_assignments for all to authenticated
  using (public.is_ops()
         and exists (select 1 from public.incidents i where i.id = incident_assignments.incident_id))
  with check (public.is_ops()
              and exists (select 1 from public.incidents i where i.id = incident_assignments.incident_id));

-- Area terbakar: siapa pun yang boleh melihat insidennya (Petugas wilayah, Admin, Penegak Hukum untuk kejadian selesai).
create policy burn_area_read on public.burn_area_reports for select to authenticated
  using (exists (select 1 from public.incidents i where i.id = burn_area_reports.incident_id));

-- Catatan telaah hukum: hanya Penegak Hukum; menulis hanya atas nama sendiri.
create policy legal_notes_read on public.legal_review_notes for select to authenticated
  using (public.is_legal());
create policy legal_notes_insert on public.legal_review_notes for insert to authenticated
  with check (public.is_legal() and author_id = auth.uid());
create policy legal_notes_update on public.legal_review_notes for update to authenticated
  using (public.is_legal() and author_id = auth.uid())
  with check (public.is_legal() and author_id = auth.uid());

-- Data pendukung dan risiko: dibaca semua akun aktif; ditulis service_role.
create policy radd_alerts_read on public.radd_alerts for select to authenticated
  using (public.current_app_role() is not null);
create policy weekly_features_read on public.region_weekly_features for select to authenticated
  using (public.current_app_role() is not null);
create policy risk_scores_read on public.risk_scores for select to authenticated
  using (public.current_app_role() is not null);

-- Audit: dibaca admin; ditulis service_role.
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.is_admin());

create policy kb_documents_admin on public.kb_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy kb_chunks_admin on public.kb_chunks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- View publik (disanitasi; dijalankan dengan hak pemilik view) ----------
-- Tidak memuat nomor telepon, foto, deskripsi, atau identitas pelapor (BW-F-5-06, BW-F-7-02).

create or replace view public.public_incidents_v as
select i.id, i.region_id, r.code as region_code, r.name as region_name,
       i.source, i.status, i.hotspot_count, i.centroid,
       i.first_detected_at, i.last_detected_at, i.closed_at
  from public.incidents i
  left join public.regions r on r.id = i.region_id
 where i.status <> 'false_alarm';

create or replace view public.public_hotspots_v as
select h.id, h.geom, h.acq_at, h.satellite, h.instrument, h.confidence_level,
       h.frp, h.in_peat, h.region_id, h.incident_id
  from public.hotspots h
 where h.filter_status = 'kept';

-- Lokasi laporan dibulatkan ke grid ±1 km agar titik pelapor tidak terbuka.
create or replace view public.public_reports_v as
select rp.id, rp.incident_id, rp.status, rp.created_at,
       extensions.st_snaptogrid(rp.geom, 0.01) as approx_geom
  from public.reports rp
 where rp.status <> 'rejected';

create or replace view public.public_risk_v as
select distinct on (rs.region_id)
       rs.region_id, r.code as region_code, r.name as region_name, r.level as region_level,
       rs.week_start, rs.level as risk_level, rs.score, rs.top_reasons, rs.method
  from public.risk_scores rs
  join public.regions r on r.id = rs.region_id
 order by rs.region_id, rs.week_start desc, case rs.method when 'xgboost' then 0 else 1 end;

-- ---------- Hak akses tingkat tabel ----------
-- anon tidak boleh menyentuh tabel; hanya view publik.
revoke all on all tables in schema public from anon;
grant select on public.public_incidents_v, public.public_hotspots_v,
                public.public_reports_v,   public.public_risk_v to anon, authenticated;
