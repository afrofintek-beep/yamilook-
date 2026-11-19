create table public.service_units (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  service text not null check (service in ('Polícia','Bombeiros','INEMA','Saúde')),
  locality text not null check (length(trim(locality)) > 0),
  coverage text not null default '',
  phone text not null check (phone ~ '^[+]244[0-9]{9}$'),
  purpose text not null check (purpose in ('Recepção','Urgência','Atendimento institucional')),
  handle uuid,
  source text not null check (source ~ '^https://'),
  reviewed date not null default current_date
);
alter table public.service_units enable row level security;
grant select on public.service_units to anon, authenticated;
grant insert, update, delete on public.service_units to authenticated;
create policy public_directory on public.service_units for select using (true);
create policy directory_admin on public.service_units for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.service_units(name,service,locality,phone,purpose,source,reviewed) values
('Clínica Sagrada Esperança','Saúde','Talatona','+244923167960','Atendimento institucional','https://clinicasagradaesperanca.co.ao/unidade/talatona','2026-11-19'),
('Clínica Sagrada Esperança','Saúde','Ilha de Luanda','+244222014571','Urgência','https://www.diplomatie.gouv.fr/fr/information-par-pays/angola/conseils-aux-voyageurs-contacts-utiles','2026-11-19'),
('Clínica Girassol','Saúde','Maianga','+244226698415','Recepção','https://www.diplomatie.gouv.fr/fr/information-par-pays/angola/conseils-aux-voyageurs-contacts-utiles','2026-11-19');

-- An administrator designates an institutional account before it can manage units.
create table public.service_institutions (
  profile_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.service_institutions enable row level security;
grant select on public.service_institutions to anon, authenticated;
grant insert, delete on public.service_institutions to authenticated;
create policy institution_listing on public.service_institutions for select using (true);
create policy institution_registration on public.service_institutions for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create function public.register_service_institution() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.institution_id is not null and public.has_role(auth.uid(),'admin') then
    insert into public.service_institutions values(new.institution_id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger register_service_institution after insert or update of institution_id on public.service_units
for each row execute function public.register_service_institution();
create policy institution_units on public.service_units for all to authenticated
using (institution_id = auth.uid() and exists (select 1 from public.service_institutions where profile_id = auth.uid()))
with check (institution_id = auth.uid() and exists (select 1 from public.service_institutions where profile_id = auth.uid()));
