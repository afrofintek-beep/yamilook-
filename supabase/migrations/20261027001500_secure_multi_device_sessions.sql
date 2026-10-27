-- Per-auth-session device management shared by YAMILOOK and KOSOLOLA.
-- No raw tokens, IP addresses, or browser fingerprints are exposed.
create table if not exists public.account_device_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null default 'Dispositivo',
  platform text not null default 'Web',
  browser text not null default 'Browser',
  app_surface text not null default 'yamilook',
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index if not exists account_device_sessions_user_idx on public.account_device_sessions(user_id);
alter table public.account_device_sessions enable row level security;
revoke all on public.account_device_sessions from public, anon, authenticated;

create table if not exists public.account_login_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin_session_id uuid not null,
  device_label text not null,
  app_surface text not null,
  occurred_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  unique(user_id, origin_session_id)
);
create index if not exists account_login_alerts_unread_idx
  on public.account_login_alerts(user_id, occurred_at desc)
  where acknowledged_at is null;
alter table public.account_login_alerts enable row level security;
revoke all on public.account_login_alerts from public, anon, authenticated;

-- Check the signed JWT's actual session against GoTrue's authoritative table.
create or replace function public.account_current_session_id()
returns uuid language plpgsql stable security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_sid uuid;
begin
  if v_uid is null or (auth.jwt()->>'session_id') is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  v_sid := (auth.jwt()->>'session_id')::uuid;
  if not exists (select 1 from auth.sessions where id=v_sid and user_id=v_uid) then
    raise exception 'Session expired or revoked' using errcode = '28000';
  end if;
  return v_sid;
end;
$$;

create or replace function public.account_register_session(
  p_label text default 'Dispositivo',
  p_platform text default 'Web',
  p_browser text default 'Browser',
  p_surface text default 'yamilook'
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_sid uuid := public.account_current_session_id();
  v_uid uuid := auth.uid();
  v_new uuid;
  v_label text := left(coalesce(nullif(btrim(p_label),''),'Dispositivo'),80);
  v_surface text := case when p_surface='kosolola' then 'kosolola' else 'yamilook' end;
begin
  insert into public.account_device_sessions
      (session_id,user_id,device_label,platform,browser,app_surface)
  values(v_sid,v_uid,v_label,
      left(coalesce(p_platform,'Web'),40),
      left(coalesce(p_browser,'Browser'),40),v_surface)
  on conflict (session_id) do nothing
  returning session_id into v_new;

  update public.account_device_sessions set last_seen=now()
    where session_id=v_sid and user_id=v_uid;

  -- Alert only once per newly observed sign-in, and only if another live
  -- authenticated session already existed. Concurrent re-registers are idempotent.
  if v_new is not null and exists (
      select 1 from auth.sessions where user_id=v_uid and id<>v_sid
    ) then
    insert into public.account_login_alerts
      (user_id,origin_session_id,device_label,app_surface)
    values (v_uid,v_sid,v_label,v_surface)
    on conflict (user_id,origin_session_id) do nothing;
  end if;
  return v_new is not null;
end;
$$;

create or replace function public.account_list_sessions()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'device_label', coalesce(d.device_label,'Sessão anterior / dispositivo desconhecido'),
      'platform', coalesce(d.platform,'Web'),
      'browser', coalesce(d.browser,'Desconhecido'),
      'app_surface', coalesce(d.app_surface,'desconhecido'),
      'first_seen', coalesce(d.first_seen,s.created_at),
      'last_seen', coalesce(d.last_seen,s.updated_at,s.created_at),
      'is_current', s.id=public.account_current_session_id()
    ) order by coalesce(d.last_seen,s.updated_at,s.created_at) desc
  ),'[]'::jsonb)
  from auth.sessions s
  left join public.account_device_sessions d on d.session_id=s.id and d.user_id=s.user_id
  where s.user_id=auth.uid() and public.account_current_session_id() is not null;
$$;

create or replace function public.account_revoke_session(p_session_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_current uuid := public.account_current_session_id();
begin
  if p_session_id is null or p_session_id=v_current then
    raise exception 'Cannot revoke the current session via remote revocation' using errcode='22023';
  end if;
  -- Remove the actual Auth session, not merely a display record.
  delete from auth.sessions where id=p_session_id and user_id=v_uid;
  if not found then
    raise exception 'Session not found' using errcode='22023';
  end if;
  return true;
end;
$$;

create or replace function public.account_list_login_alerts()
returns jsonb language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(
      jsonb_build_object('id',a.id,'device_label',a.device_label,
                        'app_surface',a.app_surface,'occurred_at',a.occurred_at,
                        'unread',a.acknowledged_at is null and a.origin_session_id<>public.account_current_session_id())
      order by a.occurred_at desc
    ),'[]'::jsonb)
  from (
    select * from public.account_login_alerts
    where user_id=auth.uid() and public.account_current_session_id() is not null
    order by occurred_at desc limit 20
  ) a;
$$;

create or replace function public.account_acknowledge_login_alerts(p_alert_ids uuid[])
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_count int;
begin
  perform public.account_current_session_id();
  update public.account_login_alerts
     set acknowledged_at=now()
   where user_id=auth.uid()
     and id=any(coalesce(p_alert_ids,array[]::uuid[]))
     and origin_session_id<>public.account_current_session_id()
     and acknowledged_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Explicitly disable obsolete single-session enforcement for older client builds.
do $guard$
begin
  if to_regprocedure('public.revoke_other_sessions(text)') is not null then
    revoke execute on function public.revoke_other_sessions(text) from public, anon, authenticated;
  end if;
end;
$guard$;
revoke all on function public.account_current_session_id() from public, anon;
revoke all on function public.account_register_session(text,text,text,text) from public, anon;
revoke all on function public.account_list_sessions() from public, anon;
revoke all on function public.account_revoke_session(uuid) from public, anon;
revoke all on function public.account_list_login_alerts() from public, anon;
revoke all on function public.account_acknowledge_login_alerts(uuid[]) from public, anon;
grant execute on function public.account_current_session_id() to authenticated;
grant execute on function public.account_register_session(text,text,text,text) to authenticated;
grant execute on function public.account_list_sessions() to authenticated;
grant execute on function public.account_revoke_session(uuid) to authenticated;
grant execute on function public.account_list_login_alerts() to authenticated;
grant execute on function public.account_acknowledge_login_alerts(uuid[]) to authenticated;
