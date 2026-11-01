create or replace function public.record_operator_report_verdict(
  p_report_id uuid,
  p_verdict text
)
returns table (
  report_id uuid,
  report_status text,
  verification_outcome text,
  incident_id uuid,
  region_id uuid,
  incident_status text
)
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  report_row public.reports;
  incident_row public.incidents;
  next_report_status text;
  next_outcome text;
begin
  if p_verdict not in ('real_fire', 'not_fire') then
    raise exception 'invalid_verdict';
  end if;
  if not public.is_ops() then
    raise exception 'forbidden';
  end if;

  select * into report_row from public.reports where id = p_report_id for update;
  if report_row.id is null then raise exception 'report_not_found'; end if;
  if report_row.incident_id is not null then
    select * into incident_row from public.incidents
     where id = report_row.incident_id for update;
    if incident_row.id is null or not public.region_in_scope(incident_row.region_id) then
      raise exception 'forbidden';
    end if;
  end if;

  next_report_status := case when p_verdict = 'real_fire' then 'verified' else 'rejected' end;
  next_outcome := case when p_verdict = 'real_fire' then 'auto_pass' else 'rejected' end;
  update public.reports
     set status = next_report_status, verification_outcome = next_outcome, updated_at = now()
   where id = p_report_id;

  if incident_row.id is not null and incident_row.status = 'new' then
    update public.incidents
       set status = case when p_verdict = 'real_fire' then 'confirmed' else 'false_alarm' end,
           updated_at = now()
     where id = incident_row.id
     returning * into incident_row;
    insert into public.incident_status_logs (
      incident_id, from_status, to_status, changed_by_profile, note
    ) values (
      incident_row.id,
      'new',
      incident_row.status,
      auth.uid(),
      'Verdict petugas pada laporan warga'
    );
  end if;

  return query select p_report_id, next_report_status, next_outcome,
    report_row.incident_id, report_row.region_id, incident_row.status;
end;
$$;

revoke all on function public.record_operator_report_verdict(uuid, text)
  from public, anon;
grant execute on function public.record_operator_report_verdict(uuid, text)
  to authenticated;
