-- Explicit map-selected residence, distinct from device GPS and deferred declarations.
-- Existing rows are unchanged. All writes still bind to auth.uid(), pending status and Banda cooldown.
alter table public.residence_declarations drop constraint residence_declarations_method_check;
alter table public.residence_declarations add constraint residence_declarations_method_check check(method in ('home','away','existing','later','map'));
create or replace function public.submit_residence_declaration(p_method text,p_country text,p_city text,p_neighborhood text,
  p_code text default null,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid(); b uuid; cur record; result jsonb; code text;
begin
 if u is null then raise exception 'unauthenticated'; end if;
 if p_method not in ('home','away','existing','later','map') or p_method is null then raise exception 'invalid_method'; end if;
 if nullif(btrim(p_country),'') is null or nullif(btrim(p_city),'') is null or nullif(btrim(p_neighborhood),'') is null
 or length(p_country)>100 or length(p_city)>100 or length(p_neighborhood)>150 then raise exception 'invalid_banda'; end if;
 if p_method='home' and (p_lat is null or p_lng is null or not(p_lat between -85 and 85) or not(p_lng between -180 and 180)
 or p_accuracy is null or not(p_accuracy>0 and p_accuracy<=1000)) then raise exception 'invalid_gps'; end if;
 if p_method='map' and (p_country is distinct from 'AO' or p_lat is null or p_lng is null or not(p_lat between -18.1 and -4.3) or not(p_lng between 11.3 and 24.1) or p_accuracy is not null) then raise exception 'invalid_map_point';end if;
 if p_method not in ('home','map') and (p_lat is not null or p_lng is not null) then raise exception 'current_location_not_home'; end if;
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
   latitude=case when p_method in ('home','map') then p_lat else null end,
   longitude=case when p_method in ('home','map') then p_lng else null end,
   afroloc_code=case when p_method='existing' then code else null end,
   afroloc_certification_status=case when p_method in ('home','existing','map') then 'pending' else 'none' end,
   afroloc_certified_at=null,afroloc_certified_by=null,updated_at=now() where id=u;
 select afroloc_code into code from public.profiles where id=u;
 insert into public.residence_declarations(user_id,method,country,city,neighborhood,address_code,gps_accuracy_m)
 values(u,p_method,btrim(p_country),btrim(p_city),btrim(p_neighborhood),code,case when p_method='home' then p_accuracy else null end)
 on conflict(user_id) do update set method=excluded.method,country=excluded.country,city=excluded.city,
 neighborhood=excluded.neighborhood,address_code=excluded.address_code,gps_accuracy_m=excluded.gps_accuracy_m,submitted_at=now();
 return jsonb_build_object('status',case when p_method in ('home','existing','map') then 'pending' else 'declared' end,'address_code',code);
end $$;
revoke all on function public.submit_residence_declaration(text,text,text,text,text,double precision,double precision,double precision) from public,anon;
grant execute on function public.submit_residence_declaration(text,text,text,text,text,double precision,double precision,double precision) to authenticated;

create or replace function residence_private.submit_administrative(
 p_method text,p_country text,p_city text,p_neighborhood text,
 p_province text,p_municipality text,p_commune text,p_complement text,p_catalog_version text,
 p_code text default null,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare u uuid:=auth.uid();prov record;mun record;com record;old_profile record;result jsonb;prefix text;code text;check_state text:='pending';base text;grid_size int;
begin
 if u is null then raise exception 'unauthenticated' using errcode='42501';end if;
 if upper(p_country)<>'AO' or p_catalog_version is distinct from 'AO-2026-11-14' then raise exception 'invalid_catalog';end if;
 if length(coalesce(p_complement,''))>250 then raise exception 'invalid_complement';end if;
 select * into prov from public.afroloc_official_divisions d where d.code=p_province and level=1;
 select * into mun from public.afroloc_official_divisions d where d.code=p_municipality and level=2 and parent_code=prov.code;
 select * into com from public.afroloc_official_divisions d where d.code=p_commune and level=3 and parent_code=mun.code;
 if prov.code is null or mun.code is null then raise exception 'invalid_hierarchy';end if;
 if exists(select 1 from public.afroloc_official_divisions where parent_code=mun.code and level=3) then
  if com.code is null then raise exception 'invalid_commune';end if;
 elsif nullif(p_commune,'') is not null then raise exception 'invalid_commune';end if;
 prefix:='AO-'||left(regexp_replace(prov.code,'^.*-',''),3)||'-'||left(regexp_replace(mun.code,'^.*-',''),3)||'-'||coalesce(left(regexp_replace(com.code,'^.*-',''),3),'000')||'-';
 code:=upper(btrim(p_code));
 if p_method='existing' and code ~ '^AO-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-[A-Z0-9]+-G[0-9]+-[A-Z0-9]+-[A-Z0-9]+$' then
  if left(code,length(prefix))<>prefix then raise exception 'address_administrative_mismatch';end if;
  check_state:='code_consistent';
 end if;
 select * into old_profile from public.profiles where id=u for update;
 if old_profile.id is null then raise exception 'missing_profile';end if;
 -- Reclassifying the same recorded residence does not erase the saved point or reissue its code.
 if p_method='existing' and code is not null and code=old_profile.afroloc_code
 and p_country=old_profile.country_code and btrim(p_city)=old_profile.city and btrim(p_neighborhood)=old_profile.neighborhood
 and p_lat is null and p_lng is null then
  insert into public.residence_declarations(user_id,method,country,city,neighborhood,address_code)
  values(u,'existing',p_country,btrim(p_city),btrim(p_neighborhood),code)
  on conflict(user_id) do nothing;
  result:=jsonb_build_object('status','pending','address_code',code);
 else
  -- This existing function enforces validation, pending certification and Banda cooldown.
  result:=public.submit_residence_declaration(p_method,p_country,p_city,p_neighborhood,p_code,p_lat,p_lng,p_accuracy);
  if p_method in ('home','map') then
   if not(p_lat between -18.1 and -4.3 and p_lng between 11.3 and 24.1) then raise exception 'outside_angola';end if;
   grid_size:=case when exists(select 1 from (values (-8.839,13.289,0.25),(-12.575,13.405,0.08),(-12.345,16.876,0.08),(-12.769,15.735,0.1),(-5.557,12.189,0.08)) c(lat,lng,r) where power(p_lat-c.lat,2)+power(p_lng-c.lng,2)<=power(c.r,2)) then 10 else 25 end;
   base:='G'||grid_size||'-'||public.afroloc_b36_signed(floor(6378137.0*radians(p_lng)/grid_size)::bigint)||'-'||public.afroloc_b36_signed(floor(6378137.0*ln(tan(pi()/4+radians(p_lat)/2))/grid_size)::bigint);
   code:=prefix||'DIG-'||base;
   update public.profiles set afroloc_code=code where id=u;
   update public.residence_declarations set address_code=code where user_id=u;
   result:=jsonb_build_object('status','pending','address_code',code);
  end if;
 end if;
 update public.residence_declarations set province_code=prov.code,municipality_code=mun.code,commune_code=com.code,
 address_complement=nullif(btrim(p_complement),''),catalog_version=p_catalog_version,territorial_check=check_state,submitted_at=now() where user_id=u;
 return result||jsonb_build_object('territorial_check',check_state);
end $$;
revoke all on function residence_private.submit_administrative(text,text,text,text,text,text,text,text,text,text,double precision,double precision,double precision) from public,anon;
grant execute on function residence_private.submit_administrative(text,text,text,text,text,text,text,text,text,text,double precision,double precision,double precision) to authenticated;
create or replace function public.can_receive_banda_benefits(p_user uuid default auth.uid()) returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profiles p where p.id=p_user and p.afroloc_code is not null and p.afroloc_certification_status='certified'
 and exists(select 1 from public.user_bandas ub where ub.user_id=p.id and ub.is_active)
 and not exists(select 1 from public.residence_declarations d where d.user_id=p.id and
 (d.method not in ('home','existing','map') or d.address_code is distinct from p.afroloc_code or d.city is distinct from p.city or d.neighborhood is distinct from p.neighborhood)));
$$;
revoke all on function public.can_receive_banda_benefits(uuid) from public,anon;
grant execute on function public.can_receive_banda_benefits(uuid) to authenticated,service_role;


-- Immutable audit of map declarations after the final administrative code is assigned.
create table residence_private.map_declaration_audit (
 id bigint generated always as identity primary key,
 actor uuid not null references public.profiles(id) on delete cascade,
 address_code text not null,
 recorded_at timestamptz not null default now()
);
alter table residence_private.map_declaration_audit enable row level security;
revoke all on residence_private.map_declaration_audit from public,anon,authenticated;
create function residence_private.audit_map_declaration() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.method='map' and new.province_code is not null and new.address_code is not null then
  insert into residence_private.map_declaration_audit(actor,address_code) values(new.user_id,new.address_code);
 end if;
 return new;
end $$;
revoke all on function residence_private.audit_map_declaration() from public,anon,authenticated;
create trigger audit_map_declaration after insert or update on public.residence_declarations
for each row execute function residence_private.audit_map_declaration();
