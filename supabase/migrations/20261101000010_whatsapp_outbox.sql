-- Store approved-template variables so queued messages can be sent after the request ends.
alter table public.wa_messages
  add column if not exists template_variables jsonb;
