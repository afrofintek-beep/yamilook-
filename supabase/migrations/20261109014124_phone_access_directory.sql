-- Native Auth remains the only source of verified telephone identities.
create table public.phone_directory_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 phone_snapshot text not null,
 enabled boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.phone_directory_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 hour_start timestamptz not null default now(),
 attempts integer not null default 0
);
create table public.phone_directory_audit (
 id bigint generated always as identity primary key,
 user_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('search','consent_on','consent_off')),
 created_at timestamptz not null default now()
);
alter table public.phone_directory_preferences enable row level security;
alter table public.phone_directory_limits enable row level security;
alter table public.phone_directory_audit enable row level security;
revoke all on public.phone_directory_preferences, public.phone_directory_limits, public.phone_directory_audit from anon, authenticated;
-- No client policies: access only through the authenticated Edge Function.
create function public.phone_directory_action(p_actor uuid, p_action text, p_phone text default null, p_enabled boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare own_phone text; opted boolean; n integer; profiles jsonb;
begin
 if not exists(select 1 from auth.users where id=p_actor and not coalesce(is_anonymous,false) and deleted_at is null) then
  raise exception 'unauthorized';
 end if;
 select phone into own_phone from auth.users where id=p_actor and phone_confirmed_at is not null;
 if p_action='status' then
  select enabled and phone_snapshot=own_phone into opted from public.phone_directory_preferences where user_id=p_actor;
  return jsonb_build_object('ok',true,'enabled',coalesce(opted,false));
 elsif p_action='consent' then
  if p_enabled is null or (p_enabled and coalesce(own_phone,'')='') then raise exception 'verified_phone_required'; end if;
  insert into public.phone_directory_preferences(user_id,phone_snapshot,enabled)
  values(p_actor,coalesce(own_phone,''),p_enabled)
  on conflict(user_id) do update set phone_snapshot=excluded.phone_snapshot,enabled=excluded.enabled,updated_at=now();
  insert into public.phone_directory_audit(user_id,action) values(p_actor,case when p_enabled then 'consent_on' else 'consent_off' end);
  return jsonb_build_object('ok',true,'enabled',p_enabled);
 elsif p_action='search' then
  if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'invalid_phone'; end if;
  insert into public.phone_directory_limits(user_id,attempts) values(p_actor,1)
  on conflict(user_id) do update set
    attempts=case when phone_directory_limits.hour_start < now()-interval '1 hour' then 1 else phone_directory_limits.attempts+1 end,
    hour_start=case when phone_directory_limits.hour_start < now()-interval '1 hour' then now() else phone_directory_limits.hour_start end
  returning attempts into n;
  -- Return, rather than raise, so the rate limit increment commits.
  if n>30 then return jsonb_build_object('ok',false,'reason','rate_limited'); end if;
  insert into public.phone_directory_audit(user_id,action) values(p_actor,'search');
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'username',p.username,'avatar_url',p.avatar_url,'bio',p.bio)),'[]'::jsonb)
    into profiles from auth.users u
    join public.phone_directory_preferences d on d.user_id=u.id and d.enabled and d.phone_snapshot=u.phone
    join public.public_profiles p on p.id=u.id
    where u.phone=ltrim(p_phone,'+') and u.phone_confirmed_at is not null and u.deleted_at is null and u.id<>p_actor
    and not exists(select 1 from public.blocked_users b where
      (b.blocker_id=p_actor and b.blocked_id=u.id) or (b.blocker_id=u.id and b.blocked_id=p_actor));
  return jsonb_build_object('ok',true,'profiles',profiles);
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function public.phone_directory_action(uuid,text,text,boolean) from public, anon, authenticated;
grant execute on function public.phone_directory_action(uuid,text,text,boolean) to service_role;

-- Attach as the Before User Created Auth hook before enabling Phone.
-- The login form's shouldCreateUser=false is UX, not a server security boundary.
create function public.reject_phone_only_signup(event jsonb)
returns jsonb language plpgsql set search_path = '' as $$
begin
 if coalesce(event->'user'->>'email','')='' and coalesce(event->'user'->>'phone','')<>'' then
  return jsonb_build_object('error',jsonb_build_object('http_code',403,'message','Use your existing account to associate a phone number.'));
 end if;
 return '{}'::jsonb;
end $$;
revoke all on function public.reject_phone_only_signup(jsonb) from public,anon,authenticated;
grant execute on function public.reject_phone_only_signup(jsonb) to supabase_auth_admin;
