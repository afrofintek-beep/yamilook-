-- Each field uses {"source": "<exact original>", "values": {"en": "<translation>", ...}}.
-- The existing row policies also cover these columns. Editorial writes remain privileged.
alter table public.mentor_profiles
  add column translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(translations) = 'object');

alter table public.academia_mentor_audit
  add column reason_translations jsonb not null default '{}'::jsonb
  check (jsonb_typeof(reason_translations) = 'object');

comment on column public.mentor_profiles.translations is
  'Editorial translations keyed by specialty, biography or experience; each entry contains the exact source and a values object keyed by locale.';
comment on column public.academia_mentor_audit.reason_translations is
  'Restricted translations of the reason for this decision; contains the exact source and a values object keyed by locale.';
