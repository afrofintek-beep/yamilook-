-- Additive metadata only; existing profiles, coordinates and codes are not backfilled.
alter table public.residence_declarations
 add column province_code text references public.afroloc_official_divisions(code),
 add column municipality_code text references public.afroloc_official_divisions(code),
 add column commune_code text references public.afroloc_official_divisions(code),
 add column address_complement text,
 add column catalog_version text,
 add column territorial_check text not null default 'pending' check(territorial_check in ('pending','code_consistent'));

create function public.my_residence_administrative() returns jsonb
language sql stable security invoker set search_path=public as $$
 select jsonb_build_object('province',province_code,'municipality',municipality_code,'commune',coalesce(commune_code,''),'complement',coalesce(address_complement,''))
 from public.residence_declarations where user_id=auth.uid() and province_code is not null;
$$;
revoke all on function public.my_residence_administrative() from public,anon;
grant execute on function public.my_residence_administrative() to authenticated;

-- Preserve an explicit/imported code when only administrative labels are edited.
-- Coordinate changes still run the existing generator.
create or replace function public.set_afroloc_code() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if (new.latitude,new.longitude,new.country_code) is not distinct from (old.latitude,old.longitude,old.country_code)
     and new.afroloc_code is not null then return new; end if;
  if (new.latitude,new.longitude,new.country_code,new.city,new.neighborhood,new.afroloc_code)
   is not distinct from (old.latitude,old.longitude,old.country_code,old.city,old.neighborhood,old.afroloc_code) then return new; end if;
 end if;
 if new.latitude is null or new.longitude is null then return new; end if;
 new.afroloc_code:=public.afroloc_admin_nom(coalesce(upper(new.country_code),'AO'),new.city,new.neighborhood,new.latitude,new.longitude);
 return new;
end $$;

create schema if not exists residence_private;
revoke all on schema residence_private from public,anon;
grant usage on schema residence_private to authenticated;
create function residence_private.submit_administrative(
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
  if p_method='home' then
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
create function public.submit_residence_administrative(
 p_method text,p_country text,p_city text,p_neighborhood text,
 p_province text,p_municipality text,p_commune text,p_complement text,p_catalog_version text,
 p_code text default null,p_lat double precision default null,p_lng double precision default null,p_accuracy double precision default null
) returns jsonb language sql security invoker set search_path=public as $$
 select residence_private.submit_administrative(p_method,p_country,p_city,p_neighborhood,p_province,p_municipality,p_commune,p_complement,p_catalog_version,p_code,p_lat,p_lng,p_accuracy);
$$;
revoke all on function public.submit_residence_administrative(text,text,text,text,text,text,text,text,text,text,double precision,double precision,double precision) from public,anon;
grant execute on function public.submit_residence_administrative(text,text,text,text,text,text,text,text,text,text,double precision,double precision,double precision) to authenticated;

-- Older clients cannot leave administrative metadata attached to a changed residence.
create function public.clear_changed_residence_administration() returns trigger language plpgsql set search_path=public as $$
begin
 if (new.country,new.city,new.neighborhood,new.address_code) is distinct from (old.country,old.city,old.neighborhood,old.address_code) then
  new.province_code:=null;new.municipality_code:=null;new.commune_code:=null;new.address_complement:=null;new.catalog_version:=null;new.territorial_check:='pending';
 end if;
 return new;
end $$;
revoke all on function public.clear_changed_residence_administration() from public,anon,authenticated;
create trigger clear_changed_residence_administration before update on public.residence_declarations for each row execute function public.clear_changed_residence_administration();

CREATE OR REPLACE FUNCTION afroloc_experience_private.handle(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 uid uuid:=auth.uid(); a public.afroloc_experience_addresses; result jsonb;
 prov public.afroloc_official_divisions; mun public.afroloc_official_divisions; com public.afroloc_official_divisions;
 lat double precision; lon double precision; compact text; generated text; request_id uuid; grid_size integer;
begin
 if uid is null then raise exception 'Sessão necessária.' using errcode='42501'; end if;
 -- Reject deleted/revoked sessions as well as anonymous accounts.
 if not exists(select 1 from auth.users where id=uid and coalesce(is_anonymous,false)=false) then raise exception 'Sessão inválida.' using errcode='42501'; end if;
 if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=uid) then raise exception 'Volte a entrar na Yamilook.' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=uid and upper(trim(country_code))='AO') then raise exception 'Seleccione Angola no seu perfil.' using errcode='42501'; end if;
 if p_action='catalog' then
  select coalesce(jsonb_agg(to_jsonb(d) order by d.level,d.name),'[]') into result from public.afroloc_official_divisions d;
  return jsonb_build_object('divisions',result);
 elsif p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result from
   (select id,label,code,neighborhood,status,review_note,created_at,expires_at from public.afroloc_experience_addresses where owner_id=uid) x;
  return jsonb_build_object('addresses',result,'canReview',public.is_moderator_or_admin(uid));
 elsif p_action='queue' then
  if not public.is_moderator_or_admin(uid) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from
   (select id,label,code,neighborhood,status,created_at,expires_at,owner_id=uid as is_own from public.afroloc_experience_addresses where status='pending' and expires_at>now() order by created_at limit 100) x;
  return jsonb_build_object('addresses',result);
 elsif p_action='create' then
  if (p_data->>'consent') is distinct from 'true' or coalesce(length(trim(p_data->>'label')),0) not between 1 and 120 or coalesce(length(trim(p_data->>'neighborhood')),0) not between 1 and 120 then raise exception 'Preencha o local e confirme a autorização.'; end if;
  request_id:=(p_data->>'id')::uuid;
  if request_id is null then raise exception 'Pedido inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into a from public.afroloc_experience_addresses where id=request_id;
  if found then
   if a.owner_id<>uid then raise exception 'Pedido indisponível.' using errcode='42501'; end if;
   return jsonb_build_object('ok',true,'id',a.id);
  end if;
  if (select count(*) from public.afroloc_experience_addresses where owner_id=uid and status<>'closed' and expires_at>now())>=3 then raise exception 'Pode manter até três endereços activos.'; end if;
  if (select count(*) from public.afroloc_experience_addresses where owner_id=uid and created_at>now()-interval '1 day')>=10 then raise exception 'Limite diário atingido.'; end if;
  select * into prov from public.afroloc_official_divisions where code=p_data->>'province' and level=1;
  select * into mun from public.afroloc_official_divisions where code=p_data->>'municipality' and level=2 and parent_code=prov.code;
  select * into com from public.afroloc_official_divisions where code=p_data->>'commune' and level=3 and parent_code=mun.code;
  if prov.code is null or mun.code is null then raise exception 'Seleccione divisões administrativas válidas.'; end if;
  if exists(select 1 from public.afroloc_official_divisions where level=3 and parent_code=mun.code) then
   if com.code is null then raise exception 'Seleccione a comuna.';end if;
  elsif nullif(p_data->>'commune','') is not null then raise exception 'Comuna inválida.';end if;
  lat:=(p_data->>'latitude')::double precision; lon:=(p_data->>'longitude')::double precision;
  if lat is null or lon is null or not(lat between -18.1 and -4.3 and lon between 11.3 and 24.1) then raise exception 'Indique uma localização em Angola.'; end if;
  -- Match the canonical AFROLOC automatic zone selection for Angola.
  grid_size:=case when exists(select 1 from (values (-8.839,13.289,0.25),(-12.575,13.405,0.08),(-12.345,16.876,0.08),(-12.769,15.735,0.1),(-5.557,12.189,0.08)) c(center_lat,center_lon,radius) where power(lat-c.center_lat,2)+power(lon-c.center_lon,2)<=power(c.radius,2)) then 10 else 25 end;
  compact:='AO-ZU-G'||grid_size||'-'||public.afroloc_b36_signed(floor(6378137.0*radians(lon)/grid_size)::bigint)||'-'||public.afroloc_b36_signed(floor(6378137.0*ln(tan(pi()/4+radians(lat)/2))/grid_size)::bigint);
  generated:='AO-'||left(regexp_replace(prov.code,'^.*-',''),3)||'-'||left(regexp_replace(mun.code,'^.*-',''),3)||'-'||coalesce(left(regexp_replace(com.code,'^.*-',''),3),'000')||'-DIG-'||substring(compact from 7);
  insert into public.afroloc_experience_addresses(id,owner_id,label,code,province_code,municipality_code,commune_code,neighborhood,latitude,longitude)
   values(request_id,uid,trim(p_data->>'label'),generated,prov.code,mun.code,coalesce(com.code,''),trim(p_data->>'neighborhood'),lat,lon);
  insert into afroloc_experience_private.audit(actor,action,address_id) values(uid,'create',request_id);
  return jsonb_build_object('ok',true,'id',request_id,'code',generated);
 end if;
 select * into a from public.afroloc_experience_addresses where id=(p_data->>'id')::uuid for update;
 if not found then raise exception 'Endereço indisponível.'; end if;
 if p_action='review' then
  if not public.is_moderator_or_admin(uid) or a.owner_id=uid then raise exception 'A revisão exige outro responsável autorizado.' using errcode='42501'; end if;
  if a.status<>'pending' or a.expires_at<=now() or coalesce(p_data->>'decision','') not in ('approved','rejected') or (p_data->>'confirmed') is distinct from 'true' or coalesce(length(trim(p_data->>'note')),0) not between 3 and 500 then raise exception 'Confirme a revisão e registe a fundamentação.'; end if;
  update public.afroloc_experience_addresses set status=p_data->>'decision',reviewer_id=uid,review_note=trim(p_data->>'note') where id=a.id;
 elsif a.owner_id<>uid then raise exception 'Sem permissão.' using errcode='42501';
 elsif p_action='close' then
  update public.afroloc_experience_addresses set status='closed' where id=a.id;
 elsif p_action='position' then
  if a.status='closed' or a.expires_at<=now() then raise exception 'Endereço encerrado ou expirado.'; end if;
  insert into afroloc_experience_private.audit(actor,action,address_id) values(uid,'position',a.id);
  return jsonb_build_object('code',a.code,'label',a.label,'point',jsonb_build_object('lat',a.latitude,'lon',a.longitude),'expiresAt',least(a.expires_at,now()+interval '30 seconds'));
 else raise exception 'Operação inválida.';
 end if;
 insert into afroloc_experience_private.audit(actor,action,address_id) values(uid,p_action,a.id);
 return jsonb_build_object('ok',true);
end $function$;
