create or replace function public.transition_incident_status(
  p_incident_id uuid,
  p_to_status text,
  p_note text default null
)
returns public.incidents
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  current_incident public.incidents;
  old_status text;
  allowed boolean;
begin
  select *
    into current_incident
    from public.incidents
   where id = p_incident_id
   for update;

  if current_incident.id is null then
    raise exception 'incident_not_found';
  end if;
  if not public.is_ops() or not public.region_in_scope(current_incident.region_id) then
    raise exception 'incident_forbidden';
  end if;

  allowed :=
    (current_incident.status = 'confirmed' and p_to_status = 'in_progress')
    or (current_incident.status = 'in_progress' and p_to_status = 'extinguished')
    or (current_incident.status = 'extinguished' and p_to_status = 'closed');
  if not allowed then
    raise exception 'invalid_status_transition';
  end if;
  old_status := current_incident.status;

  update public.incidents
     set status = p_to_status,
         closed_at = case when p_to_status in ('extinguished', 'closed') then now() else closed_at end,
         updated_at = now()
   where id = p_incident_id
   returning * into current_incident;

  insert into public.incident_status_logs (
    incident_id, from_status, to_status, changed_by_profile, note
  )
  values (
    p_incident_id,
    old_status,
    p_to_status,
    auth.uid(),
    nullif(trim(p_note), '')
  );

  return current_incident;
end;
$$;

revoke execute on function public.transition_incident_status(uuid, text, text)
  from public, anon;
grant execute on function public.transition_incident_status(uuid, text, text)
  to authenticated;
