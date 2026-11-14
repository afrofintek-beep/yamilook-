-- Isolated experimental addresses. Does not modify profiles or certification.
create schema if not exists afroloc_experience_private;
revoke all on schema afroloc_experience_private from public,anon,authenticated;
create table if not exists public.afroloc_experience_addresses (
 id uuid primary key, owner_id uuid not null references auth.users(id),
 label text not null check(length(label) between 1 and 120), code text not null,
 province_code text not null, municipality_code text not null, commune_code text not null,
 neighborhood text not null, latitude double precision not null, longitude double precision not null,
 status text not null default 'pending' check(status in ('pending','approved','rejected','closed')),
 reviewer_id uuid references auth.users(id), review_note text,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 days'
);
create index if not exists afroloc_experience_owner_idx on public.afroloc_experience_addresses(owner_id,created_at);
alter table public.afroloc_experience_addresses enable row level security;
revoke all on public.afroloc_experience_addresses from public,anon,authenticated;
create table if not exists afroloc_experience_private.audit (
 id bigint generated always as identity primary key, actor uuid not null,
 action text not null, address_id uuid, created_at timestamptz not null default now()
);
alter table afroloc_experience_private.audit enable row level security;
create or replace function afroloc_experience_private.handle(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
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
  if prov.code is null or mun.code is null or com.code is null then raise exception 'Seleccione divisões administrativas válidas.'; end if;
  lat:=(p_data->>'latitude')::double precision; lon:=(p_data->>'longitude')::double precision;
  if lat is null or lon is null or not(lat between -18.1 and -4.3 and lon between 11.3 and 24.1) then raise exception 'Indique uma localização em Angola.'; end if;
  -- Match the canonical AFROLOC automatic zone selection for Angola.
  grid_size:=case when exists(select 1 from (values (-8.839,13.289,0.25),(-12.575,13.405,0.08),(-12.345,16.876,0.08),(-12.769,15.735,0.1),(-5.557,12.189,0.08)) c(center_lat,center_lon,radius) where power(lat-c.center_lat,2)+power(lon-c.center_lon,2)<=power(c.radius,2)) then 10 else 25 end;
  compact:='AO-ZU-G'||grid_size||'-'||public.afroloc_b36_signed(floor(6378137.0*radians(lon)/grid_size)::bigint)||'-'||public.afroloc_b36_signed(floor(6378137.0*ln(tan(pi()/4+radians(lat)/2))/grid_size)::bigint);
  generated:='AO-'||left(regexp_replace(prov.code,'^.*-',''),3)||'-'||left(regexp_replace(mun.code,'^.*-',''),3)||'-'||left(regexp_replace(com.code,'^.*-',''),3)||'-DIG-'||substring(compact from 7);
  insert into public.afroloc_experience_addresses(id,owner_id,label,code,province_code,municipality_code,commune_code,neighborhood,latitude,longitude)
   values(request_id,uid,trim(p_data->>'label'),generated,prov.code,mun.code,com.code,trim(p_data->>'neighborhood'),lat,lon);
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
end $$;
revoke all on function afroloc_experience_private.handle(text,jsonb) from public,anon;
grant usage on schema afroloc_experience_private to authenticated;
grant execute on function afroloc_experience_private.handle(text,jsonb) to authenticated;
create or replace function public.afroloc_experience_action(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path=public,pg_temp as $$select afroloc_experience_private.handle(p_action,p_data)$$;
revoke all on function public.afroloc_experience_action(text,jsonb) from public,anon;
grant execute on function public.afroloc_experience_action(text,jsonb) to authenticated;
