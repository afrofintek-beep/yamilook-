-- Explicit owner consent, per recipient. Existing grants stay online-only.
-- This permits only the remainder of the current 20-second location response;
-- it does not extend the grant, source expiry, precision or storage permission.
alter table locaccess_private.grants
  add column offline_continuation boolean not null default false;
comment on column locaccess_private.grants.offline_continuation is
  'Owner opt-in for session-only use of an issued response until its original expiry; no offline renewal.';

create or replace function locaccess_private.action(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a locaccess_private.addresses; g locaccess_private.grants;
 source text:=p_data->>'id'; v_code text:=p_data->>'code'; point jsonb; result jsonb;
 term text; recipient uuid; recipient_count integer; radius integer; hours integer; lat double precision; lon double precision;
 accuracy double precision; stamp double precision; distance double precision; expiry timestamptz;
 entry_lat double precision; entry_lon double precision; has_external_route boolean;
 offline_consent boolean:=false; offline_mode text:='forbidden';
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false))
  or not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=uid)
  or not exists(select 1 from public.profiles where id=uid and account_status='active') then
  raise exception 'Volte a entrar na Yamilook.' using errcode='42501';
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4000 then raise exception 'Pedido inválido.';end if;
 if p_action='search' then
  term:=translate(lower(ltrim(trim(coalesce(p_data->>'query','')),'@')),'áàâãäåéèêëíìîïóòôõöúùûüçñ','aaaaaaeeeeiiiiooooouuuucn');
  if length(term)<2 or length(term)>64 then return '[]'::jsonb;end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'display_name',p.display_name,'avatar_url',p.avatar_url) order by p.rank,p.username,p.id),'[]'::jsonb) into result from (
   select x.id,x.username,x.display_name,x.avatar_url,case when lower(x.username)=term then 0 else 1 end as rank
   from public.profiles x where x.account_status='active' and x.id<>uid and nullif(trim(x.username),'') is not null
    and (position(term in translate(lower(x.username),'áàâãäåéèêëíìîïóòôõöúùûüçñ','aaaaaaeeeeiiiiooooouuuucn'))>0
     or position(term in translate(lower(coalesce(x.display_name,'')),'áàâãäåéèêëíìîïóòôõöúùûüçñ','aaaaaaeeeeiiiiooooouuuucn'))>0)
   order by rank,x.username,x.id limit 8
  ) p;
  return result;
 end if;
 if p_action in ('visit','external_route') then
  select * into a from locaccess_private.addresses where handle=(p_data->>'handle')::uuid;
  if not found then return jsonb_build_object('status','denied');end if;
  if a.owner_id<>uid then
   if not a.enabled then return jsonb_build_object('status','denied');end if;
   select * into g from locaccess_private.grants where handle=a.handle and recipient_id=uid and revoked_at is null and expires_at>now();
   if not found then return jsonb_build_object('status','denied');end if;
  end if;
  point:=locaccess_private.position(a.owner_id,a.source_id,a.code);
  if point is null then return jsonb_build_object('status','denied');end if;
  expiry:=least(now()+interval '20 seconds',g.expires_at,(point->>'deadline')::timestamptz);
  has_external_route:=g.google_entry_lat is not null and not (
    round(g.google_entry_lat::numeric,5)=round((point->>'lat')::numeric,5)
    and round(g.google_entry_lon::numeric,5)=round((point->>'lon')::numeric,5));
  if p_action='external_route' then
   if not has_external_route then return jsonb_build_object('status','denied');end if;
   return jsonb_build_object('status','ready','entryPoint',jsonb_build_object('lat',g.google_entry_lat,'lon',g.google_entry_lon),'expiresAt',expiry);
  end if;
  offline_mode:=case when a.owner_id<>uid and coalesce(g.offline_continuation,false) then 'permitted' else 'forbidden' end;
  if a.owner_id<>uid and g.radius>0 then
   result:=jsonb_build_object('status','proximity','radius',g.radius,'hasExternalRoute',has_external_route,'expiresAt',expiry,'offlineContinuation',offline_mode,'area',jsonb_build_object('lat',round((point->>'lat')::numeric/0.02)*0.02,'lon',round((point->>'lon')::numeric/0.02)*0.02,'radius',2000));
   if jsonb_typeof(p_data->'position') is distinct from 'object' then return result;end if;
   begin
    lat:=(p_data->'position'->>'lat')::double precision;lon:=(p_data->'position'->>'lon')::double precision;
    accuracy:=(p_data->'position'->>'accuracy')::double precision;stamp:=(p_data->'position'->>'timestamp')::double precision;
   exception when others then return result;end;
   if lat is null or lon is null or accuracy is null or stamp is null
    or not(lat between -90 and 90 and lon between -180 and 180 and accuracy between 0 and least(50,g.radius/2))
    or not(stamp between extract(epoch from clock_timestamp())*1000-20000 and extract(epoch from clock_timestamp())*1000+5000) then return result;end if;
   distance:=6371000*2*asin(sqrt(least(1.0,power(sin(radians(lat-(point->>'lat')::double precision)/2),2)+cos(radians(lat))*cos(radians((point->>'lat')::double precision))*power(sin(radians(lon-(point->>'lon')::double precision)/2),2))));
   if distance+accuracy>g.radius then return result;end if;
  end if;
  return jsonb_build_object('status','ready','point',jsonb_build_object('lat',point->'lat','lon',point->'lon'),'expiresAt',expiry,'owner',a.owner_id=uid,'hasExternalRoute',has_external_route,'offlineContinuation',offline_mode);
 end if;
 if p_action not in ('owner','grant','revoke','close') then raise exception 'Pedido inválido.';end if;
 if source is null or v_code is null or length(v_code)>160 or (source<>'residence' and source!~'^[0-9a-fA-F-]{36}$') then raise exception 'Endereço inválido.';end if;
 point:=locaccess_private.position(uid,source,v_code);
 -- The owner can still revoke expired or changed addresses, but cannot grant them.
 if point is null and p_action not in ('owner','close','revoke') then raise exception 'Endereço indisponível ou expirado.';end if;
 if point is not null then
  insert into locaccess_private.addresses(owner_id,source_id,code) values(uid,source,v_code) on conflict(owner_id,source_id,code) do nothing;
 end if;
 select * into a from locaccess_private.addresses where owner_id=uid and source_id=source and addresses.code=v_code for update;
 if not found then raise exception 'Endereço indisponível.';end if;
 if p_action='grant' then
  if p_data ? 'offline_continuation' and jsonb_typeof(p_data->'offline_continuation') is distinct from 'boolean' then
   raise exception 'Pedido inválido.';
  end if;
  offline_consent:=coalesce((p_data->>'offline_continuation')::boolean,false);
  radius:=(p_data->>'radius')::integer;hours:=(p_data->>'hours')::integer;
  if radius is null or radius not in (0,100,250,500) or hours is null or hours not in (1,24,168) then raise exception 'Escolha o modo e a validade do acesso.';end if;
  if length(trim(p_data->>'username')) not between 1 and 64 then raise exception 'Indique o nome de utilizador.';end if;
  select count(*),min(id::text)::uuid into recipient_count,recipient from public.profiles where lower(username)=lower(trim(p_data->>'username')) and account_status='active' and id<>uid;
  if recipient is null or recipient_count<>1 then raise exception 'Utilizador indisponível. Confirme o nome de utilizador Yamilook.';end if;
  if p_data ? 'recipient_id' and (p_data->>'recipient_id')::uuid is distinct from recipient then raise exception 'A conta mudou. Pesquisa e selecciona novamente a pessoa.';end if;
  if p_data ? 'google_entry' then
   if jsonb_typeof(p_data->'google_entry') is distinct from 'object'
    or jsonb_typeof(p_data->'google_entry'->'lat') is distinct from 'number'
    or jsonb_typeof(p_data->'google_entry'->'lon') is distinct from 'number' then
    raise exception 'Indica coordenadas válidas para a entrada pública.';
   end if;
   entry_lat:=(p_data->'google_entry'->>'lat')::double precision;
   entry_lon:=(p_data->'google_entry'->>'lon')::double precision;
   if not(entry_lat between -90 and 90 and entry_lon between -180 and 180) then
    raise exception 'Indica coordenadas válidas para a entrada pública.';
   end if;
   if round(entry_lat::numeric,5)=round((point->>'lat')::numeric,5)
     and round(entry_lon::numeric,5)=round((point->>'lon')::numeric,5) then
    raise exception 'Escolhe uma entrada pública diferente da morada.';
   end if;
  end if;
  insert into locaccess_private.grants(handle,recipient_id,radius,expires_at,google_entry_lat,google_entry_lon,offline_continuation)
   values(a.handle,recipient,radius,least(now()+make_interval(hours=>hours),(point->>'deadline')::timestamptz),entry_lat,entry_lon,offline_consent)
   on conflict(handle,recipient_id) do update set radius=excluded.radius,expires_at=excluded.expires_at,
    google_entry_lat=excluded.google_entry_lat,google_entry_lon=excluded.google_entry_lon,offline_continuation=excluded.offline_continuation,revoked_at=null,updated_at=now();
  update locaccess_private.addresses set enabled=true where handle=a.handle;
 elsif p_action='revoke' then
  update locaccess_private.grants set revoked_at=now(),updated_at=now() where id=(p_data->>'grant_id')::uuid and handle=a.handle;
 elsif p_action='close' then
  update locaccess_private.addresses set enabled=false where handle=a.handle;
  update locaccess_private.grants set revoked_at=now(),updated_at=now() where handle=a.handle and revoked_at is null;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'username',p.username,'radius',x.radius,'expiresAt',x.expires_at,'hasExternalRoute',x.google_entry_lat is not null,'offlineContinuation',x.offline_continuation) order by x.updated_at desc),'[]'::jsonb) into result
  from locaccess_private.grants x join public.profiles p on p.id=x.recipient_id where x.handle=a.handle and x.revoked_at is null and x.expires_at>now();
 return jsonb_build_object('handle',a.handle,'enabled',(select enabled from locaccess_private.addresses where handle=a.handle),'grants',result);
end $$;

-- Preserve the private checked implementation and the existing invoker wrapper.
revoke all on function locaccess_private.action(text,jsonb) from public,anon;
grant execute on function locaccess_private.action(text,jsonb) to authenticated;
