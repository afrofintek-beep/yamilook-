import { randomUUID } from 'node:crypto';

export const projectId = 'kvnbqqektpkeouyepyor';
const quote = text => `'${String(text).replaceAll("'", "''")}'`;
const markerGuard = `do $guard$ begin
  if to_regclass('massa_test_harness.installation') is null then raise exception 'MASSA harness marker missing'; end if;
  if not exists(select 1 from massa_test_harness.installation where singleton and target_project='${projectId}') then
    raise exception 'Wrong MASSA test harness target';
  end if;
end $guard$;`;

// Builds SQL only. No driver, URL, credentials, HTTP client or automatic remote
// execution. The caller must bind every call to the explicit projectId above.
export function makeRemoteChecks() {
  const ids = Object.fromEntries(['buyer', 'seller', 'admin', 'order', 'requestA', 'requestB', 'charge', 'session'].map(key => [key, randomUUID()]));
  const run = randomUUID().replaceAll('-', '').slice(0, 12);
  const merchant = `MASSA_DB_TEST_${run}`;
  const amountMinor = 12345;
  const application = stage => `massa_db_${run}_${stage}`;
  const auth = user => `select set_config('request.jwt.claim.sub',${quote(user)},true);
    select set_config('request.jwt.claims',${quote(JSON.stringify({ session_id: ids.session, aal: 'aal2' }))},true);`;
  const getAttempt = `public.massa_gateway_get(${quote(ids.buyer)},null,${quote(ids.order)},null)`;

  const setup = `begin;
set local statement_timeout='15s';
${markerGuard}
do $$ begin
 if exists(select 1 from auth.users) or exists(select 1 from massa_gateway.attempts)
    or exists(select 1 from public.payment_point_entries) then raise exception 'Concurrency fixture requires empty test data'; end if;
end $$;
insert into auth.users(id,email) values
 (${quote(ids.buyer)},${quote(`massa-db-${run}-buyer@example.invalid`)}),
 (${quote(ids.seller)},${quote(`massa-db-${run}-seller@example.invalid`)}),
 (${quote(ids.admin)},${quote(`massa-db-${run}-admin@example.invalid`)});
insert into public.profiles(id,display_name,username,country_code) values
 (${quote(ids.buyer)},'Synthetic MASSA buyer',${quote(`massa_db_${run}_buyer`)},'AO'),
 (${quote(ids.seller)},'Synthetic MASSA seller',${quote(`massa_db_${run}_seller`)},'AO'),
 (${quote(ids.admin)},'Synthetic MASSA test administrator',${quote(`massa_db_${run}_admin`)},'AO');
insert into public.user_roles(user_id,role) values(${quote(ids.admin)},'admin');
${auth(ids.admin)}
set local role authenticated;
select public.wallet_pilot_manage('grant',${quote(ids.buyer)});
select public.wallet_pilot_manage('grant',${quote(ids.seller)});
reset role;
${auth(ids.seller)}
set local role authenticated;
select public.payment_point_action('merchant');
select public.payment_point_action('create',${quote(ids.order)},${amountMinor},'Synthetic database concurrency verification');
reset role;
select 'synthetic fixture ready' result,pg_backend_pid() backend_pid;
commit;`;

  function sessionSql(stage, body, expectedRejection = false) {
    // Sleep deliberately retains the transaction's advisory lock after the
    // operation, providing an observable overlap window for the other backend.
    return `begin;
set local statement_timeout='30s';
set local lock_timeout='20s';
set local application_name=${quote(application(stage))};
${markerGuard}
select set_config('massa.test_started',clock_timestamp()::text,true);
set local role service_role;
do $test$ declare result jsonb; begin
 begin
  ${body}
  perform set_config('massa.test_result',result::text,true);
 ${expectedRejection ? `exception when others then
  if sqlerrm !~ 'em curso' then raise; end if;
  perform set_config('massa.test_result',jsonb_build_object('rejected',true,'reason','active_attempt','sqlstate',sqlstate)::text,true);` : ''}
 end;
end $test$;
select pg_sleep(6);
reset role;
select ${quote(stage)} stage, pg_backend_pid() backend_pid,
 current_setting('massa.test_started')::timestamptz started_at,clock_timestamp() finished_at,
 current_setting('massa.test_result')::jsonb->>'id' attempt_id,
 current_setting('massa.test_result')::jsonb->>'state' state,
 current_setting('massa.test_result')::jsonb->>'submit' submit,
 current_setting('massa.test_result')::jsonb->>'rejected' rejected;
commit;`;
  }

  const prepareA = sessionSql('prepare_a', `result:=public.massa_gateway_prepare(${quote(ids.buyer)},${quote(ids.requestA)},'REF',null,${quote(merchant)},${quote(ids.order)},null);`, true);
  const prepareB = sessionSql('prepare_b', `result:=public.massa_gateway_prepare(${quote(ids.buyer)},${quote(ids.requestB)},'REF',null,${quote(merchant)},${quote(ids.order)},null);`, true);
  const recordPending = `begin;
${markerGuard}
set local role service_role;
with a as(select ${getAttempt} v)
 select public.massa_gateway_record((v->>'id')::uuid,${quote(ids.charge)},'pending',101) from a;
commit;`;
  const confirmBody = `result:=${getAttempt};
  result:=public.massa_gateway_confirm((result->>'id')::uuid,${quote(ids.charge)},result->>'merchant_ref',${amountMinor},'AOA','REF');`;
  const confirmA = sessionSql('confirm_a', confirmBody);
  const confirmB = sessionSql('confirm_b', confirmBody);
  const monitor = `select pid,application_name,state,wait_event_type,wait_event,pg_blocking_pids(pid) blockers,
 exists(select 1 from pg_locks l where l.pid=a.pid and l.locktype='advisory' and l.classid=0 and l.objid=7218961 and l.granted) holds_wallet_lock,
 exists(select 1 from pg_locks l where l.pid=a.pid and l.locktype='advisory' and l.classid=0 and l.objid=7218961 and not l.granted) waits_wallet_lock
from pg_stat_activity a where application_name like ${quote(`massa_db_${run}_%`)} order by application_name;`;
  const inspect = `${markerGuard}
select
 (select count(*) from auth.users) auth_users,
 (select count(*) from public.user_roles) roles,
 (select count(*) from public.wallet_pilot_access) pilot_grants,
 (select count(*) from massa_gateway.attempts where merchant=${quote(merchant)}) attempts,
 (select state from massa_gateway.attempts where merchant=${quote(merchant)}) attempt_state,
 (select count(*) from massa_gateway.observations o join massa_gateway.attempts a on a.id=o.attempt_id where a.merchant=${quote(merchant)}) observations,
 (select count(*) from payment_point_private.journals where reference=${quote(ids.order)}) journals,
 (select count(*) from public.payment_point_entries where reference=${quote(ids.order)}) ledger_entries,
 (select coalesce(sum(amount),0) from public.payment_point_entries where reference=${quote(ids.order)}) ledger_sum,
 (select earned from public.payment_point_wallets where user_id=${quote(ids.seller)}) seller_earned,
 (select payment_provider from public.payment_point_orders where id=${quote(ids.order)}) payment_provider;`;
  const cleanup = `begin;
${markerGuard}
do $$ begin
 if (select count(*) from auth.users where id in (${quote(ids.buyer)},${quote(ids.seller)},${quote(ids.admin)}) and email like ${quote(`massa-db-${run}-%@example.invalid`)}) <> 3 then
  raise exception 'Synthetic identity guard failed';
 end if;
end $$;
delete from public.wallet_pilot_access where user_id in (${quote(ids.buyer)},${quote(ids.seller)}) and granted_by=${quote(ids.admin)};
delete from public.user_roles where user_id=${quote(ids.admin)} and role='admin';
delete from auth.users where id=${quote(ids.admin)} and email=${quote(`massa-db-${run}-admin@example.invalid`)};
-- Buyer/seller are retained because real attempts, orders and the immutable
-- ledger reference them. Do not disable triggers or cascade financial history.
select 'synthetic grants revoked and temporary administrator removed' result;
commit;`;
  return { projectId, run, ids, merchant, amountMinor, setup, prepareA, prepareB, recordPending, confirmA, confirmB, monitor, inspect, cleanup };
}
