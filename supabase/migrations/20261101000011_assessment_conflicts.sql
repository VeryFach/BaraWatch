create or replace function public.record_mpa_assessment(
  p_incident_id uuid,
  p_contact_id uuid,
  p_verdict text
)
returns table (
  assessment_id uuid,
  conflict_detected boolean,
  needs_review boolean
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  inserted_id uuid;
  has_conflict boolean;
begin
  if p_verdict not in ('real_fire', 'not_fire') then
    raise exception 'invalid_assessment_verdict';
  end if;

  insert into public.assessments (incident_id, contact_id, verdict)
  values (p_incident_id, p_contact_id, p_verdict)
  returning id into inserted_id;

  select exists (
    select 1
      from public.assessments a
     where a.incident_id = p_incident_id
       and a.is_current
     group by a.incident_id
    having count(distinct a.verdict) > 1
  ) into has_conflict;

  if has_conflict then
    update public.incidents
       set needs_review = true
     where id = p_incident_id;
  end if;

  return query
  select inserted_id, has_conflict, coalesce(
    (select i.needs_review from public.incidents i where i.id = p_incident_id),
    false
  );
end;
$$;

revoke all on function public.record_mpa_assessment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_mpa_assessment(uuid, uuid, text)
  to service_role;
