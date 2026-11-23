alter table public.business_profiles
  add column activity_planned boolean not null default false,
  add constraint business_planned_without_start_year check (not activity_planned or start_year is null);
