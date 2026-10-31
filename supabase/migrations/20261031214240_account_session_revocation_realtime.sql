-- Notify active KOSOLOLA/YAMILOOK clients when one of their auth sessions
-- is revoked. The browser treats this as a hint and checks auth.sessions
-- through account_current_session_id before signing out.
create table if not exists public.account_session_revocations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  revoked_at timestamptz not null default now()
);

create index if not exists account_session_revocations_user_idx
  on public.account_session_revocations(user_id, revoked_at desc);

alter table public.account_session_revocations enable row level security;
revoke all on public.account_session_revocations from public, anon, authenticated;
grant select on public.account_session_revocations to authenticated;

create policy account_session_revocations_owner_read
  on public.account_session_revocations
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Publish INSERT only; unlike DELETE events, these are checked against RLS.
do $publication$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='account_session_revocations'
    ) then
    alter publication supabase_realtime add table public.account_session_revocations;
  end if;
end;
$publication$;

-- Keep both the server-side revocation and its notification atomic.
-- Never emit events for another user's session or for the current session.
create or replace function public.account_revoke_session(p_session_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_current uuid := public.account_current_session_id();
begin
  if p_session_id is null or p_session_id = v_current then
    raise exception 'Cannot revoke the current session via remote revocation' using errcode = '22023';
  end if;

  delete from auth.sessions
    where id = p_session_id and user_id = v_uid;
  if not found then
    raise exception 'Session not found' using errcode = '22023';
  end if;

  insert into public.account_session_revocations(user_id, session_id)
    values (v_uid, p_session_id);
  return true;
end;
$function$;

revoke all on function public.account_revoke_session(uuid) from public, anon;
grant execute on function public.account_revoke_session(uuid) to authenticated;
