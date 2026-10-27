-- Standalone PostgreSQL contract test. No real Supabase data or credentials.
-- Run: psql -v ON_ERROR_STOP=1 -f supabase/tests/account_sessions_integration.sql
create role anon nologin;
create role authenticated nologin;
create schema auth;
-- Match production Supabase grants: RLS may call auth.uid() as authenticated.
grant usage on schema auth to authenticated;
create table auth.users (id uuid primary key);
create table auth.sessions (
  id uuid primary key, user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt()->>'sub','')::uuid;
$$;
create function public.revoke_other_sessions(current_session_id text default null)
returns void language plpgsql as $$ begin null; end; $$;

\ir ../migrations/20261027001500_secure_multi_device_sessions.sql
\ir ../migrations/20261027074500_account_session_revocation_realtime.sql

-- These fixtures live only in the temporary CI database.
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
insert into auth.sessions (id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','22222222-2222-4222-8222-222222222222');

do $$
begin
 if has_function_privilege('anon','public.account_revoke_session(uuid)','execute') then
   raise exception 'Anonymous role can revoke sessions';
 end if;
 if has_function_privilege('authenticated','public.revoke_other_sessions(text)','execute') then
   raise exception 'Legacy single-session RPC still executable';
 end if;
 if has_table_privilege('anon','public.account_session_revocations','select') then
   raise exception 'Anonymous account can read revocation notifications';
 end if;
 if has_table_privilege('authenticated','public.account_device_sessions','select')
    or has_table_privilege('authenticated','public.account_login_alerts','select') then
   raise exception 'Authentication metadata leaked to Data API';
 end if;
end $$;

set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',false);
select public.account_register_session('iOS Safari','iOS','Safari','kosolola');

do $$
begin
 if jsonb_array_length(public.account_list_sessions()) <> 1 then
   raise exception 'First account should have exactly one session';
 end if;
 if jsonb_array_length(public.account_list_login_alerts()) <> 0 then
   -- The returned JSON array is empty until a second login.
   raise exception 'Unexpected alert';
 end if;
end $$;

reset role;
insert into auth.sessions (id,user_id) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111');
set role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',false);
select public.account_register_session('Windows Chrome','Windows','Chrome','yamilook');

do $$
declare v_list jsonb := public.account_list_sessions();
begin
 if jsonb_array_length(v_list) <> 2 then
   raise exception 'Both simultaneous sessions must remain active';
 end if;
 if (select count(*) from jsonb_array_elements(v_list) x
     where (x->>'is_current')::boolean) <> 1 then
   raise exception 'Current session marker should be unique';
 end if;
 if jsonb_array_length(public.account_list_login_alerts()) <> 1 then
   raise exception 'Expected one new-login security alert';
 end if;
end $$;

-- Restore current JWT to the first session, which must see the alert.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","session_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}',false);
do $$
declare v_alerts jsonb := public.account_list_login_alerts();
begin
 if (v_alerts->0->>'unread')::boolean is not true then
   raise exception 'Existing device must see new-login alert';
 end if;
 perform public.account_acknowledge_login_alerts(array[(v_alerts->0->>'id')::uuid]);
 if (public.account_list_login_alerts()->0->>'unread')::boolean then
   raise exception 'Alert acknowledgement did not persist';
 end if;
end $$;

-- Neither the current session nor another user's session may be revoked.
do $$
begin
 begin
   perform public.account_revoke_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
   raise exception 'Current session was revoked';
 exception when sqlstate '22023' then null;
 end;
 begin
   perform public.account_revoke_session('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
   raise exception 'Cross-user session was revoked';
 exception when sqlstate '22023' then null;
 end;
end $$;

select public.account_revoke_session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
do $$
begin
 if (select count(*) from public.account_session_revocations where session_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1 then
   raise exception 'Revocation event not created atomically';
 end if;
 if not exists (select 1 from public.account_session_revocations where user_id=auth.uid()) then
   raise exception 'Owner cannot read its own revocation event';
 end if;
end $$;
do $$
begin
 if jsonb_array_length(public.account_list_sessions())<>1 then
   raise exception 'Targeted revocation did not remove exactly one session';
 end if;
end $$;

-- Once revoked, an old signed JWT must fail on these sensitive RPCs.
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","session_id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}',false);
do $$
begin
 begin
   perform public.account_list_sessions();
   raise exception 'Revoked JWT was accepted';
 exception when sqlstate '28000' then null;
 end;
end $$;

-- Second user sees only their own sessions.
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","session_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}',false);
do $$
begin
 if jsonb_array_length(public.account_list_sessions())<>1
    or jsonb_array_length(public.account_list_login_alerts())<>0
    or (select count(*) from public.account_session_revocations)<>0 then
   raise exception 'Cross-user session/alert disclosure';
 end if;
end $$;
reset role;
select 'Multi-device SQL contract PASSED' as result;
