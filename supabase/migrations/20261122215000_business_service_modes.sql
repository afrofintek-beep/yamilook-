alter table public.business_profiles
  add column start_year integer check (start_year between 1 and extract(year from current_date)),
  add column service_modes text[] not null default '{}' check (service_modes <@ array['shop','home','delivery','online']::text[]);
