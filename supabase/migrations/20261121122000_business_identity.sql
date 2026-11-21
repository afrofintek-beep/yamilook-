alter table public.business_profiles
  add column handle text unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  add column afroloc_code text,
  add column service_area text;
