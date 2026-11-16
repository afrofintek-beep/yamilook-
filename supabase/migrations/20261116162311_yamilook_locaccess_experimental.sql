-- Experimental, recipient-bound access. No account, auth-trigger or existing address rewrites.
create schema if not exists locaccess_private;
revoke all on schema locaccess_private from public,anon,authenticated;
create table locaccess_private.addresses (
 handle uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id) on delete cascade,
 source_id text not null,
 code text not null,
 enabled boolean not null default false,
 created_at timestamptz not null default now(),
 unique(owner_id,source_id,code)
);
create index locaccess_address_code on locaccess_private.addresses(code);
create table locaccess_private.grants (
 id uuid primary key default gen_random_uuid(),
 handle uuid not null references locaccess_private.addresses(handle) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 radius integer not null check(radius in (0,100,250,500)),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(handle,recipient_id)
);
create index locaccess_grant_recipient on locaccess_private.grants(recipient_id);
alter table locaccess_private.addresses enable row level security;
alter table locaccess_private.grants enable row level security;
revoke all on all tables in schema locaccess_private from public,anon,authenticated;

create function locaccess_private.position(p_owner uuid,p_source text,p_code text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare lat double precision; lon double precision; deadline timestamptz;
begin
 if not exists(select 1 from public.profiles where id=p_owner and account_status='active') then return null; end if;
 if p_source='residence' then
  select latitude,longitude into lat,lon from public.profiles where id=p_owner and afroloc_code=p_code and upper(country_code)='AO' and afroloc_certification_status<>'rejected';
 else
  select latitude,longitude,expires_at into lat,lon,deadline from public.afroloc_experience_addresses
   where id=p_source::uuid and owner_id=p_owner and code=p_code and status in ('pending','approved') and expires_at>now();
 end if;
 if lat is null or lon is null or not(lat between -90 and 90 and lon between -180 and 180) then return null;end if;
 return jsonb_build_object('lat',lat,'lon',lon,'deadline',deadline);
end $$;
revoke all on function locaccess_private.position(uuid,text,text) from public,anon,authenticated;

create function locaccess_private.action(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a locaccess_private.addresses; g locaccess_private.grants;
 source text:=p_data->>'id'; v_code text:=p_data->>'code'; point jsonb; result jsonb;
 recipient uuid; recipient_count integer; radius integer; hours integer; lat double precision; lon double precision;
 accuracy double precision; stamp double precision; distance double precision; expiry timestamptz;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false))
  or not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=uid)
  or not exists(select 1 from public.profiles where id=uid and account_status='active') then
  raise exception 'Volte a entrar na Yamilook.' using errcode='42501';
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>4000 then raise exception 'Pedido inválido.';end if;
 if p_action='visit' then
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
  if a.owner_id<>uid and g.radius>0 then
   result:=jsonb_build_object('status','proximity','radius',g.radius,'area',jsonb_build_object('lat',round((point->>'lat')::numeric/0.02)*0.02,'lon',round((point->>'lon')::numeric/0.02)*0.02,'radius',2000));
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
  return jsonb_build_object('status','ready','point',jsonb_build_object('lat',point->'lat','lon',point->'lon'),'expiresAt',expiry,'owner',a.owner_id=uid);
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
  radius:=(p_data->>'radius')::integer;hours:=(p_data->>'hours')::integer;
  if radius is null or radius not in (0,100,250,500) or hours is null or hours not in (1,24,168) then raise exception 'Escolha o modo e a validade do acesso.';end if;
  if length(trim(p_data->>'username')) not between 1 and 64 then raise exception 'Indique o nome de utilizador.';end if;
  select count(*),min(id::text)::uuid into recipient_count,recipient from public.profiles where lower(username)=lower(trim(p_data->>'username')) and account_status='active' and id<>uid;
  if recipient is null or recipient_count<>1 then raise exception 'Utilizador indisponível. Confirme o nome de utilizador Yamilook.';end if;
  insert into locaccess_private.grants(handle,recipient_id,radius,expires_at) values(a.handle,recipient,radius,least(now()+make_interval(hours=>hours),(point->>'deadline')::timestamptz))
   on conflict(handle,recipient_id) do update set radius=excluded.radius,expires_at=excluded.expires_at,revoked_at=null,updated_at=now();
  update locaccess_private.addresses set enabled=true where handle=a.handle;
 elsif p_action='revoke' then
  update locaccess_private.grants set revoked_at=now(),updated_at=now() where id=(p_data->>'grant_id')::uuid and handle=a.handle;
 elsif p_action='close' then
  update locaccess_private.addresses set enabled=false where handle=a.handle;
  update locaccess_private.grants set revoked_at=now(),updated_at=now() where handle=a.handle and revoked_at is null;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'username',p.username,'radius',x.radius,'expiresAt',x.expires_at) order by x.updated_at desc),'[]'::jsonb) into result
  from locaccess_private.grants x join public.profiles p on p.id=x.recipient_id where x.handle=a.handle and x.revoked_at is null and x.expires_at>now();
 return jsonb_build_object('handle',a.handle,'enabled',(select enabled from locaccess_private.addresses where handle=a.handle),'grants',result);
end $$;
revoke all on function locaccess_private.action(text,jsonb) from public,anon;
grant usage on schema locaccess_private to authenticated;
grant execute on function locaccess_private.action(text,jsonb) to authenticated;
create function public.locaccess_action(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select locaccess_private.action(p_action,p_data)$$;
revoke all on function public.locaccess_action(text,jsonb) from public,anon;
grant execute on function public.locaccess_action(text,jsonb) to authenticated;

-- Called only by the server-side legacy QR lookup; protected codes never resolve publicly.
create function public.locaccess_reference_protected(p_reference text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from locaccess_private.addresses where code=p_reference)
$$;
revoke all on function public.locaccess_reference_protected(text) from public,anon,authenticated;
grant execute on function public.locaccess_reference_protected(text) to service_role;
