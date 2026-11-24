-- Database-only verification. No HTTP, Edge Function, gateway, cron or email.
-- Execute only against kvnbqqektpkeouyepyor after reviewing the harness.
-- All synthetic accounts, role assignments, balances and observations roll back.
begin;
set local statement_timeout = '15s';
set local lock_timeout = '3s';

do $guard$
begin
  if to_regclass('massa_test_harness.installation') is null then
    raise exception 'Dedicated MASSA test harness marker missing';
  end if;
  if not exists (select 1 from massa_test_harness.installation
    where target_project='kvnbqqektpkeouyepyor' and singleton) then
    raise exception 'Wrong MASSA harness target';
  end if;
  if exists (select 1 from auth.users) then
    raise exception 'Rollback verification requires no existing accounts';
  end if;
end;
$guard$;

-- Invoker helpers only: assertions run under the role being tested.
create temporary table harness_session_only(id integer) on commit drop;
create function pg_temp.expect_error(p_sql text, p_message_pattern text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm !~ p_message_pattern then raise; end if;
    return;
  end;
  raise exception 'Expected rejection did not occur: %', p_message_pattern;
end;
$$;
create function pg_temp.require(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_ok is not true then raise exception 'MASSA verification failed: %', p_label; end if;
end;
$$;
do $$ begin
  execute format('grant usage on schema %I to anon, authenticated, service_role',
    (select nspname from pg_namespace where oid=pg_my_temp_schema()));
end $$;
grant execute on function pg_temp.expect_error(text,text), pg_temp.require(boolean,text)
  to anon, authenticated, service_role;

insert into auth.users(id,email) values
 ('4d415353-4150-4000-8000-000000000001','massa-harness-1@example.invalid'),
 ('4d415353-4150-4000-8000-000000000002','massa-harness-2@example.invalid'),
 ('4d415353-4150-4000-8000-000000000003','massa-harness-3@example.invalid'),
 ('4d415353-4150-4000-8000-000000000009','massa-harness-9@example.invalid');
insert into public.profiles(id,display_name,username,country_code)
 select id,'Synthetic MASSA '||right(id::text,1),'massa_harness_'||right(id::text,1),'AO'
 from auth.users;
insert into public.user_roles(user_id,role)
 values('4d415353-4150-4000-8000-000000000009','admin');

set local role anon;
select pg_temp.expect_error('select * from massa_gateway.attempts','permission denied');
select pg_temp.expect_error('select public.massa_gateway_due(''MASSA_PG_ROLLBACK'')','permission denied');
reset role;

set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000001';
set local request.jwt.claims = '{"session_id":"4d415353-4150-4000-8000-000000000999","aal":"aal2"}';
set local role authenticated;
select pg_temp.require(not public.has_wallet_access(),'uninvited actor denied');
select pg_temp.expect_error('select public.payment_point_action(''overview'')','reservado');
select pg_temp.expect_error('select public.wallet_pilot_manage(''grant'',''4d415353-4150-4000-8000-000000000001'')','administradores');
select pg_temp.expect_error('insert into public.user_roles(user_id,role) values(''4d415353-4150-4000-8000-000000000001'',''admin'')','permission denied');
select pg_temp.expect_error('select public.massa_gateway_due(''MASSA_PG_ROLLBACK'')','permission denied');
reset role;

set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000009';
set local role authenticated;
select pg_temp.require(public.has_role(auth.uid(),'admin'),'real administrator role lookup');
select public.wallet_pilot_manage('grant','4d415353-4150-4000-8000-000000000001');
select public.wallet_pilot_manage('grant','4d415353-4150-4000-8000-000000000002');
reset role;

set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000001';
set local role authenticated;
select pg_temp.require(public.has_wallet_access(),'administrator grant takes effect');
select public.payment_point_action('topup','4d415353-4150-4000-8000-000000000301',20000);
reset role;
set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000002';
set local role authenticated;
select public.payment_point_action('merchant');
select public.payment_point_action('create','4d415353-4150-4000-8000-000000000302',500,'Synthetic authorisation check');
select public.payment_point_action('create','4d415353-4150-4000-8000-000000000303',12345,'Synthetic confirmation check');
select public.payment_point_action('create','4d415353-4150-4000-8000-000000000304',600,'Synthetic expiry check');
reset role;

update public.profiles set country_code='PT' where id='4d415353-4150-4000-8000-000000000001';
set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error('select public.payment_point_action(''topup'',''4d415353-4150-4000-8000-000000000305'',100)','Angola');
reset role;
set local role service_role;
select pg_temp.expect_error('select public.massa_gateway_prepare(''4d415353-4150-4000-8000-000000000001'',''4d415353-4150-4000-8000-000000000401'',''REF'',null,''MASSA_PG_ROLLBACK'',null,100)','Angola');
select pg_temp.expect_error('select * from massa_gateway.attempts','permission denied');
reset role;
update public.profiles set country_code='AO' where id='4d415353-4150-4000-8000-000000000001';
update public.profiles set country_code='PT' where id='4d415353-4150-4000-8000-000000000002';
set local role service_role;
select pg_temp.expect_error('select public.massa_gateway_prepare(''4d415353-4150-4000-8000-000000000001'',''4d415353-4150-4000-8000-000000000401'',''REF'',null,''MASSA_PG_ROLLBACK'',''4d415353-4150-4000-8000-000000000303'',null)','Destinatário indisponível');
reset role;
update public.profiles set country_code='AO' where id='4d415353-4150-4000-8000-000000000002';

set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error('select public.payment_point_action(''pay'',''4d415353-4150-4000-8000-000000000302'')','chave da carteira');
select public.wallet_preferences(true);
select pg_temp.expect_error('select public.payment_point_action(''pay'',''4d415353-4150-4000-8000-000000000302'')','bloqueadas');
select public.wallet_preferences(false);
reset role;

set local role service_role;
select pg_temp.require((public.massa_gateway_prepare(
 '4d415353-4150-4000-8000-000000000001','4d415353-4150-4000-8000-000000000401',
 'REF',null,'MASSA_PG_ROLLBACK','4d415353-4150-4000-8000-000000000303',null)->>'submit')::boolean,'first attempt');
select pg_temp.require(not (public.massa_gateway_prepare(
 '4d415353-4150-4000-8000-000000000001','4d415353-4150-4000-8000-000000000401',
 'REF',null,'MASSA_PG_ROLLBACK','4d415353-4150-4000-8000-000000000303',null)->>'submit')::boolean,'replay cannot request another POST');
select pg_temp.expect_error('select public.massa_gateway_prepare(''4d415353-4150-4000-8000-000000000001'',''4d415353-4150-4000-8000-000000000402'',''REF'',null,''MASSA_PG_ROLLBACK'',''4d415353-4150-4000-8000-000000000303'',null)','em curso');
with a as (select public.massa_gateway_get('4d415353-4150-4000-8000-000000000001',null,null,'4d415353-4150-4000-8000-000000000401') v)
 select public.massa_gateway_record((v->>'id')::uuid,'4d415353-4150-4000-8000-000000000801','pending',101) from a;
reset role;

set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000001';
set local role authenticated;
select pg_temp.expect_error('select public.payment_point_action(''pay'',''4d415353-4150-4000-8000-000000000303'')','externa');
reset role;
set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_error('select public.payment_point_action(''cancel'',''4d415353-4150-4000-8000-000000000303'')','externa');
reset role;

set local role service_role;
with a as (select public.massa_gateway_get('4d415353-4150-4000-8000-000000000001',null,null,'4d415353-4150-4000-8000-000000000401') v)
 select pg_temp.require(public.massa_gateway_confirm((v->>'id')::uuid,
  '4d415353-4150-4000-8000-000000000801',v->>'merchant_ref',12345,'AOA','REF')->>'state'='confirmed','trusted confirmation') from a;
with a as (select public.massa_gateway_get('4d415353-4150-4000-8000-000000000001',null,null,'4d415353-4150-4000-8000-000000000401') v)
 select pg_temp.require(public.massa_gateway_confirm((v->>'id')::uuid,
  '4d415353-4150-4000-8000-000000000801',v->>'merchant_ref',12345,'AOA','REF')->>'state'='confirmed','idempotent confirmation replay') from a;
reset role;
select pg_temp.require((select count(*)=1 from payment_point_private.journals where reference='4d415353-4150-4000-8000-000000000303'),'one journal only');
select pg_temp.require((select count(*)=2 and sum(amount)=0 from public.payment_point_entries where reference='4d415353-4150-4000-8000-000000000303'),'balanced two-entry journal');
select pg_temp.require((select earned=12345 from public.payment_point_wallets where user_id='4d415353-4150-4000-8000-000000000002'),'seller credited once');
select pg_temp.require((select purchased=20000 from public.payment_point_wallets where user_id='4d415353-4150-4000-8000-000000000001'),'external charge did not debit wallet');
select pg_temp.expect_error('delete from public.payment_point_entries where reference=''4d415353-4150-4000-8000-000000000303''','Immutable ledger');
set local role authenticated;
select pg_temp.expect_error('select public.payment_point_action(''refund'',''4d415353-4150-4000-8000-000000000303'')','prestador');
reset role;

set local role service_role;
select public.massa_gateway_prepare('4d415353-4150-4000-8000-000000000001','4d415353-4150-4000-8000-000000000403','REF',null,'MASSA_PG_ROLLBACK','4d415353-4150-4000-8000-000000000304',null);
reset role;
update public.payment_point_orders set expires_at=clock_timestamp()-interval '1 minute' where id='4d415353-4150-4000-8000-000000000304';
set local role service_role;
with a as (select public.massa_gateway_get('4d415353-4150-4000-8000-000000000001',null,null,'4d415353-4150-4000-8000-000000000403') v),
 c as (select public.massa_gateway_confirm((v->>'id')::uuid,'4d415353-4150-4000-8000-000000000802',v->>'merchant_ref',600,'AOA','REF') v from a)
 select pg_temp.require(v->>'state'='review' and (v->>'observed_paid')::boolean and v->>'issue_code'='order_unavailable_after_payment','late payment evidence retained without credit') from c;
reset role;
select pg_temp.require((select count(*)=0 from payment_point_private.journals where reference='4d415353-4150-4000-8000-000000000304'),'late payment creates no journal');

set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000003';
set local role authenticated;
select pg_temp.require((select count(*)=1 from public.profiles),'owner-only profile read');
select pg_temp.require((select count(*)=0 from public.payment_point_wallets),'uninvited user sees no balances');
select pg_temp.require((select count(*)=0 from public.payment_point_orders),'uninvited user sees no orders');
select pg_temp.require((select count(*)=0 from public.payment_point_entries),'uninvited user sees no ledger entries');
reset role;
set local request.jwt.claim.sub = '4d415353-4150-4000-8000-000000000009';
set local role authenticated;
select public.wallet_pilot_manage('revoke','4d415353-4150-4000-8000-000000000001');
reset role;
set local role service_role;
select pg_temp.expect_error('select public.massa_gateway_prepare(''4d415353-4150-4000-8000-000000000001'',''4d415353-4150-4000-8000-000000000404'',''REF'',null,''MASSA_PG_ROLLBACK'',null,100)','reservado');
reset role;

-- Fire deferred balance checks while the synthetic journals still exist.
set constraints all immediate;
select 'MASSA rollback verification passed' as result;
rollback;
