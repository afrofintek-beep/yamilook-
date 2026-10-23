-- Residence is declared independently of the user's current location.
create table public.residence_declarations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  method text not null check (method in ('home','away','existing','later')),
  country text not null, city text not null, neighborhood text not null,
  address_code text, gps_accuracy_m double precision,
  submitted_at timestamptz not null default now()
);
alter table public.residence_declarations enable row level security;
revoke all on public.residence_declarations from anon,authenticated;
grant select on public.residence_declarations to authenticated;
create policy residence_read on public.residence_declarations for select to authenticated
using (user_id=(select auth.uid()) or public.is_moderator_or_admin((select auth.uid())));

create function public.submit_residence_declaration(p_method text,p_country text,p_city text,p_neighborhood text,
  p_code text default null,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); b uuid; cur record; result jsonb; code text;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 if p_method not in ('home','away','existing','later') or p_method is null then raise exception 'invalid_method'; end if;
 if nullif(btrim(p_country),'') is null or nullif(btrim(p_city),'') is null or nullif(btrim(p_neighborhood),'') is null
 or length(p_country)>100 or length(p_city)>100 or length(p_neighborhood)>150 then raise exception 'invalid_banda'; end if;
 if p_method='home' and (p_lat is null or p_lng is null or not(p_lat between -85 and 85) or not(p_lng between -180 and 180)
 or p_accuracy is null or not(p_accuracy>0 and p_accuracy<=1000)) then raise exception 'invalid_gps'; end if;
 if p_method<>'home' and (p_lat is not null or p_lng is not null) then raise exception 'current_location_not_home'; end if;
 code:=upper(nullif(btrim(p_code),''));
 if p_method='existing' and (code is null or code !~ '^[A-Z0-9]+(-[A-Z0-9]+){2,}$' or length(code)>160) then raise exception 'invalid_address'; end if;
 -- Serialize declarations and preserve the existing Banda-change cooldown.
 perform 1 from public.profiles where id=u for update;
 select ub.banda_id,b.name,b.city into cur from public.user_bandas ub join public.bandas b on b.id=ub.banda_id where ub.user_id=u and ub.is_active limit 1;
 if cur.banda_id is null then
   b:=public.join_banda_by_location(btrim(p_neighborhood),btrim(p_city),p_country);
 elsif lower(btrim(cur.name))<>lower(btrim(p_neighborhood)) or lower(btrim(coalesce(cur.city,'')))<>lower(btrim(p_city)) then
   result:=public.change_banda(p_neighborhood,p_city,p_country,null,null,p_neighborhood);
   if not coalesce((result->>'ok')::boolean,false) then raise exception 'banda_change_%',result->>'reason'; end if;
 end if;
 update public.profiles set country_code=btrim(p_country),city=btrim(p_city),neighborhood=btrim(p_neighborhood),
   latitude=case when p_method='home' then p_lat else null end,
   longitude=case when p_method='home' then p_lng else null end,
   afroloc_code=case when p_method='existing' then code else null end,
   afroloc_certification_status=case when p_method in ('home','existing') then 'pending' else 'none' end,
   afroloc_certified_at=null,afroloc_certified_by=null,updated_at=now() where id=u;
 select afroloc_code into code from public.profiles where id=u;
 insert into public.residence_declarations(user_id,method,country,city,neighborhood,address_code,gps_accuracy_m)
 values(u,p_method,btrim(p_country),btrim(p_city),btrim(p_neighborhood),code,case when p_method='home' then p_accuracy else null end)
 on conflict(user_id) do update set method=excluded.method,country=excluded.country,city=excluded.city,
 neighborhood=excluded.neighborhood,address_code=excluded.address_code,gps_accuracy_m=excluded.gps_accuracy_m,submitted_at=now();
 return jsonb_build_object('status',case when p_method in ('home','existing') then 'pending' else 'declared' end,'address_code',code);
end $$;
revoke all on function public.submit_residence_declaration(text,text,text,text,text,double precision,double precision,double precision) from public,anon;
grant execute on function public.submit_residence_declaration(text,text,text,text,text,double precision,double precision,double precision) to authenticated;

create function public.can_receive_banda_benefits(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=p_user and p.afroloc_code is not null and p.afroloc_certification_status='certified'
 and exists(select 1 from public.user_bandas ub where ub.user_id=p.id and ub.is_active)
 and not exists(select 1 from public.residence_declarations d where d.user_id=p.id and
 (d.method not in ('home','existing') or d.address_code is distinct from p.afroloc_code or d.city is distinct from p.city or d.neighborhood is distinct from p.neighborhood)));
$$;
revoke all on function public.can_receive_banda_benefits(uuid) from public,anon;
grant execute on function public.can_receive_banda_benefits(uuid) to authenticated,service_role;

create function public.guard_territorial_kumbu() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.amount>0 and new.source in ('banda','territorial','banda_bonus') and not public.can_receive_banda_benefits(new.user_id) then
   raise exception 'Banda por validar: benefício territorial indisponível';
 end if;
 return new;
end $$;
revoke all on function public.guard_territorial_kumbu() from public,anon,authenticated;
create trigger guard_territorial_kumbu before insert on public.kumbu_ledger for each row execute function public.guard_territorial_kumbu();

-- Moving does not reuse an old address's certificate. Presence check-ins never update this address.
create function public.invalidate_changed_residence() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.latitude,new.longitude,new.country_code,new.city,new.neighborhood,new.afroloc_code)
 is distinct from (old.latitude,old.longitude,old.country_code,old.city,old.neighborhood,old.afroloc_code)
 and old.afroloc_certification_status='certified' then
 new.afroloc_certification_status:=case when new.afroloc_code is null and new.latitude is null then 'none' else 'pending' end;new.afroloc_certified_at:=null;new.afroloc_certified_by:=null;
 end if;
 return new;
end $$;
revoke all on function public.invalidate_changed_residence() from public,anon,authenticated;
create trigger zz_invalidate_changed_residence before update on public.profiles for each row execute function public.invalidate_changed_residence();
