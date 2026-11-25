-- Purpose-specific MAGUELA public pickup designation. No existing visit grant
-- confers transport permission. No private coordinate or cross-app session is returned.
create table locaccess_private.maguela_pickups (
 grant_id uuid primary key references locaccess_private.grants(id) on delete cascade,
 grant_version timestamptz not null,
 public_reference text not null check(length(public_reference) between 1 and 128),
 created_at timestamptz not null default now()
);
alter table locaccess_private.maguela_pickups enable row level security;
revoke all on locaccess_private.maguela_pickups from public,anon,authenticated;

create function locaccess_private.maguela_pickup(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); a locaccess_private.addresses; g locaccess_private.grants;
 p locaccess_private.maguela_pickups; source jsonb; ref text; expiry timestamptz;
 denied constant jsonb:='{"status":"denied"}'::jsonb;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and not coalesce(is_anonymous,false))
  or not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=uid)
  or not exists(select 1 from public.profiles where id=uid and account_status='active') then
  raise exception 'Volte a entrar na Yamilook.' using errcode='42501';
 end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>1024
  or coalesce(p_data->>'handle','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then return denied; end if;
 select * into a from locaccess_private.addresses where handle=(p_data->>'handle')::uuid;
 if not found then return denied; end if;
 if p_action in ('set','clear','owner_status') then
  if a.owner_id<>uid or coalesce(p_data->>'grant_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return denied; end if;
  select * into g from locaccess_private.grants where id=(p_data->>'grant_id')::uuid and handle=a.handle for update;
  if not found then return denied; end if;
  if p_action='clear' then
   delete from locaccess_private.maguela_pickups where grant_id=g.id;
   return '{"status":"cleared"}'::jsonb;
  end if;
 elsif p_action='resolve' then
  -- Only the authenticated recipient may resolve a designation.
  select * into g from locaccess_private.grants where handle=a.handle and recipient_id=uid;
  if not found then return denied; end if;
 else return denied;
 end if;
 if not a.enabled or g.revoked_at is not null or g.expires_at<=now()
  or not exists(select 1 from public.profiles where id=g.recipient_id and account_status='active') then return denied; end if;
 source:=locaccess_private.position(a.owner_id,a.source_id,a.code);
 if source is null then return denied; end if;
 if p_action='set' then
  if jsonb_typeof(p_data->'reference') is distinct from 'string' then return denied; end if;
  ref:=trim(p_data->>'reference');
  -- User-entered public designation only. Never derive a reference from the residence.
  if ref !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'
   or upper(ref)=upper(a.code)
   or exists(select 1 from locaccess_private.addresses x where upper(x.code)=upper(ref)) then return denied; end if;
  insert into locaccess_private.maguela_pickups(grant_id,grant_version,public_reference)
   values(g.id,g.updated_at,ref) on conflict(grant_id) do update set grant_version=excluded.grant_version,public_reference=excluded.public_reference,created_at=now();
  return '{"status":"designated"}'::jsonb;
 end if;
 select * into p from locaccess_private.maguela_pickups where grant_id=g.id and grant_version=g.updated_at;
 if not found or upper(p.public_reference)=upper(a.code)
  or exists(select 1 from locaccess_private.addresses x where upper(x.code)=upper(p.public_reference)) then return denied; end if;
 if p_action='owner_status' then return jsonb_build_object('status','designated','reference',p.public_reference);end if;
 expiry:=least(now()+interval '20 seconds',g.expires_at,(source->>'deadline')::timestamptz);
 if expiry<=now() then return denied; end if;
 return jsonb_build_object('status','ready','reference',p.public_reference,'expiresAt',expiry);
end $$;
revoke all on function locaccess_private.maguela_pickup(text,jsonb) from public,anon,authenticated;
grant execute on function locaccess_private.maguela_pickup(text,jsonb) to authenticated;
create function public.locaccess_maguela_pickup(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select locaccess_private.maguela_pickup(p_action,p_data)$$;
revoke all on function public.locaccess_maguela_pickup(text,jsonb) from public,anon,authenticated;
grant execute on function public.locaccess_maguela_pickup(text,jsonb) to authenticated;
