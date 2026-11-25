import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyHarness } from '../massa-appypay/fixtures/harness.mjs';

// Isolated PostgreSQL engine only: no project credentials or network/database
// connection. The immutable harness checks the original migration source hashes.
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const merchant = 'unitel-sandbox-test';
const phone = '923000001';
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  grant usage on schema auth to authenticated, service_role;
`);
await applyHarness(db);
await db.exec(readFileSync('supabase/migrations/20261125074047_massa_unitel_sandbox.sql', 'utf8'));
for (const n of [1, 2, 3, 4, 5, 9]) {
  await db.query('insert into auth.users(id,email) values($1,$2)', [id(n), `unitel${n}@example.invalid`]);
  await db.query("insert into profiles(id,display_name,username,country_code) values($1,$2,$2,'AO')", [id(n), `unitel${n}`]);
}
await db.query("insert into user_roles(user_id,role) values($1,'admin')", [id(9)]);
await db.query('insert into wallet_pilot_access(user_id,granted_by) select id,$1 from auth.users where id<>$2', [id(9), id(5)]);

async function asRole(role, callback, user = null) {
  await db.exec(`set role ${role}; set request.jwt.claim.sub='${user ? id(user) : ''}'; set request.jwt.claims='${JSON.stringify({ session_id: id(999), aal: 'aal2' })}'`);
  try { return await callback(); } finally { await db.exec('reset role'); }
}
async function rpc(name, values = []) {
  return asRole('service_role', async () => (await db.query(`select public.${name}(${values.map((_, n) => `$${n + 1}`).join(',')}) result`, values)).rows[0].result);
}
async function act(user, action, reference = null, amount = null, text = null) {
  return asRole('authenticated', async () => (await db.query('select public.payment_point_action($1,$2,$3,$4) result', [action, reference, amount, text])).rows[0].result, user);
}
async function order(n, amount = 12345, seller = 2) {
  await act(seller, 'merchant');
  await act(seller, 'create', id(n), amount, `UNITEL test ${n}`);
  return id(n);
}
async function prepare(request, orderId, extra = {}) {
  return rpc('massa_unitel_prepare', [id(extra.actor ?? 1), id(request), orderId, extra.phone ?? phone,
    extra.merchant ?? merchant, extra.allowed ?? [id(2), id(4)]]);
}
async function record(attempt, state = 'pending', extra = {}) {
  return rpc('massa_unitel_record', [attempt.id, state, extra.conversation ?? null, extra.receipt ?? null,
    extra.code ?? null, extra.issue ?? null, extra.paid ?? false, extra.bindIdentity ?? true]);
}
async function confirm(attempt, receipt = `BAH${attempt.request_id.slice(-12)}`, reference = attempt.merchant_ref) {
  return rpc('massa_unitel_confirm', [attempt.id, receipt, reference]);
}
async function appyPrepare(request, orderId) {
  return rpc('massa_gateway_prepare', [id(1), id(request), 'REF', null, 'appy-sandbox-test', orderId, null]);
}
async function appyRecord(attempt, state, charge = id(8000)) {
  return rpc('massa_gateway_record', [attempt.id, charge, state, state === 'failed' ? 200 : 101]);
}
async function appyConfirm(attempt) {
  return rpc('massa_gateway_confirm', [attempt.id, attempt.provider_charge_id, attempt.merchant_ref, attempt.amount_minor, 'AOA', 'REF']);
}
const balance = async user => (await act(user, 'overview')).wallet;
const journals = async reference => (await db.query("select count(*)::int n from payment_point_private.journals where reference=$1 and operation='payment'", [reference])).rows[0].n;
const get = async attempt => rpc('massa_unitel_get', [id(1), attempt.id]);

await test('private RLS storage and every UNITEL mutation/read RPC are inaccessible to browser roles', async () => {
  const calls = [
    ['massa_unitel_prepare', [id(1), id(100), id(101), phone, merchant, [id(2)]]],
    ['massa_unitel_get', [id(1), id(100)]],
    ['massa_unitel_find', [merchant, 'afm_u_test']],
    ['massa_unitel_record', [id(100)]],
    ['massa_unitel_confirm', [id(100), 'BAH100', 'afm_u_test']],
    ['massa_unitel_event', ['a'.repeat(64), merchant]],
    ['massa_unitel_event_done', [id(100)]],
    ['massa_unitel_due', [merchant]],
    ['massa_unitel_events_due', [merchant]],
  ];
  for (const role of ['anon', 'authenticated']) {
    await asRole(role, async () => {
      for (const [name, values] of calls) await assert.rejects(db.query(`select public.${name}(${values.map((_, n) => `$${n + 1}`).join(',')})`, values), /permission denied/);
      await assert.rejects(db.query('select * from massa_unitel.attempts'), /permission denied/);
      await assert.rejects(db.query('select * from massa_unitel.events'), /permission denied/);
    }, 1);
  }
  await asRole('service_role', async () => {
    await assert.rejects(db.query('select * from massa_unitel.attempts'), /permission denied/);
    await assert.rejects(db.query('select massa_gateway.confirm_appypay_impl(null,null,null,null,null,null)'), /permission denied/);
  });
  const tables = (await db.query("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='massa_unitel' and c.relkind='r'")).rows;
  assert.equal(tables.length, 3); assert.ok(tables.every(table => table.relrowsecurity));
  const functions = (await db.query("select prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'massa_unitel_%'")).rows;
  assert.equal(functions.length, 9); assert.ok(functions.every(fn => fn.prosecdef && fn.proconfig.includes('search_path=""')));
});

await test('only eligible sandbox orders can be prepared; amount and beneficiary are server-derived', async () => {
  const orderId = await order(101);
  await assert.rejects(prepare(201, null), /inválida/);
  await assert.rejects(prepare(201, orderId, { actor: 2 }), /indisponível/);
  await assert.rejects(prepare(201, orderId, { actor: 5 }), /reservado/);
  await assert.rejects(prepare(201, orderId, { allowed: [] }), /inválida/);
  await assert.rejects(prepare(201, orderId, { allowed: [id(4)] }), /piloto/);
  await assert.rejects(prepare(201, orderId, { allowed: [null] }), /piloto/);
  await assert.rejects(prepare(201, orderId, { phone: '+244923000001' }), /inválida/);
  await db.query("update profiles set country_code='PT' where id=$1", [id(1)]);
  await assert.rejects(prepare(201, orderId), /Angola/);
  await db.query("update profiles set country_code='AO' where id=$1", [id(1)]);
  await db.query("update payment_point_orders set expires_at=now()-interval '1 minute' where id=$1", [orderId]);
  await assert.rejects(prepare(201, orderId), /indisponível/);
  assert.equal(await journals(orderId), 0);
});

let payment;
await test('stable idempotency chooses one submitter and blocks local, UNITEL and AppyPay duplicate charges', async () => {
  const orderId = await order(102, 12345);
  const params = [id(1), id(202), orderId, phone, merchant, [id(2)]];
  const outcomes = await asRole('service_role', () => Promise.all([
    db.query('select public.massa_unitel_prepare($1,$2,$3,$4,$5,$6) result', params),
    db.query('select public.massa_unitel_prepare($1,$2,$3,$4,$5,$6) result', params),
  ]));
  assert.equal(outcomes.filter(result => result.rows[0].result.submit).length, 1);
  payment = outcomes[0].rows[0].result;
  assert.equal(payment.id, outcomes[1].rows[0].result.id);
  assert.equal(payment.amount_minor, 12345); assert.equal(payment.beneficiary_id, id(2));
  assert.equal(payment.environment, 'sandbox'); assert.equal(payment.provider, 'unitel');
  assert.match(payment.merchant_ref, /^afm_u_[0-9a-f]{32}$/);
  assert.equal((await prepare(202, orderId)).submit, false);
  await assert.rejects(prepare(202, orderId, { phone: '923000002' }), /idempotente/);
  await assert.rejects(prepare(202, orderId, { merchant: 'another-merchant' }), /idempotente/);
  await assert.rejects(prepare(202, orderId, { allowed: [id(4)] }), /piloto/);
  await assert.rejects(prepare(203, orderId), /externa/);
  await assert.rejects(appyPrepare(204, orderId), /externa/);
  await assert.rejects(act(1, 'pay', orderId), /externa/);
  await assert.rejects(act(2, 'cancel', orderId), /externa/);
  await assert.rejects(act(1, 'topup', payment.id, 100), /reservada/);
  await assert.rejects(db.query("update payment_point_orders set status='cancelled' where id=$1", [orderId]), /externa/);
  await assert.rejects(db.query("update massa_unitel.attempts set environment='production' where id=$1", [payment.id]), /check constraint/);
});

await test('uncertain submissions recover by request ID and seller reads never expose the payer phone', async () => {
  payment = await record(payment, 'uncertain', { issue: 'create_timeout' });
  assert.equal((await rpc('massa_unitel_get', [id(1), null, null, id(202)])).id, payment.id);
  assert.equal((await prepare(202, payment.order_id)).submit, false);
  assert.equal((await get(payment)).phone, phone);
  const seller = await rpc('massa_unitel_get', [id(2), null, payment.order_id]);
  assert.equal(seller.id, payment.id); assert.equal(seller.phone, null);
  await assert.rejects(rpc('massa_unitel_get', [id(3), payment.id]), /permissão/);
  await assert.rejects(rpc('massa_unitel_get', [id(1), payment.id, payment.order_id]), /inválida/);
  assert.equal((await rpc('massa_unitel_find', [merchant, payment.merchant_ref])).id, payment.id);
  assert.equal(await rpc('massa_unitel_find', ['wrong-merchant', payment.merchant_ref]), null);
});

await test('forged callbacks only enter a deduplicated inbox and cannot bind IDs, mark paid or credit money', async () => {
  const values = ['a'.repeat(64), merchant, payment.merchant_ref, 'AG_FORGED', 'BAH_FORGED', 0];
  const event = await rpc('massa_unitel_event', values);
  assert.equal(event.attempt_id, payment.id); assert.equal(event.duplicate, false);
  const duplicate = await rpc('massa_unitel_event', values);
  assert.equal(duplicate.event_id, event.event_id); assert.equal(duplicate.duplicate, true);
  const unchanged = await get(payment);
  assert.equal(unchanged.state, 'uncertain'); assert.equal(unchanged.observed_paid, false);
  assert.equal(unchanged.provider_conversation_id, null); assert.equal(unchanged.provider_transaction_id, null);
  assert.equal(await journals(payment.order_id), 0);
  const unknown = await rpc('massa_unitel_event', ['b'.repeat(64), merchant, 'afm_u_unknown', 'AG_UNKNOWN', 'BAH_UNKNOWN', 0]);
  assert.equal(unknown.event_id, null);
  assert.equal((await db.query('select count(*)::int n from massa_unitel.events')).rows[0].n, 1);
});

await test('provider acceptance stays pending; trusted confirmation posts exactly one balanced sandbox payment', async () => {
  payment = await record(payment, 'pending', { conversation: 'AG_20261125_ACCEPTED', code: 0 });
  assert.equal(payment.state, 'pending'); assert.equal(payment.provider_code, 0);
  assert.equal(await journals(payment.order_id), 0);
  await assert.rejects(record(payment, 'confirmed'), /inválido/);
  const before = await balance(2);
  payment = await confirm(payment, 'BAH_CONFIRMED_1');
  assert.equal(payment.state, 'confirmed'); assert.equal(payment.observed_paid, true);
  assert.equal((await balance(2)).earned, before.earned + payment.amount_minor);
  const view = await act(2, 'view', payment.order_id);
  assert.equal(view.status, 'paid'); assert.equal(view.payment_provider, 'unitel');
  assert.equal(await journals(payment.order_id), 1);
  const entries = (await db.query('select user_id,account,amount from payment_point_entries where reference=$1 order by amount', [payment.order_id])).rows;
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map(entry => [entry.account, Number(entry.amount)]), [['clearing', -12345], ['earned', 12345]]);
  assert.equal(entries[1].user_id, id(2));
});

await test('confirmation replays cannot credit twice, regress state or refund through the local wallet', async () => {
  const before = await balance(2);
  const outcomes = await asRole('service_role', () => Promise.all([
    db.query('select public.massa_unitel_confirm($1,$2,$3) result', [payment.id, 'BAH_CONFIRMED_1', payment.merchant_ref]),
    db.query('select public.massa_unitel_confirm($1,$2,$3) result', [payment.id, 'BAH_CONFIRMED_1', payment.merchant_ref]),
  ]));
  assert.ok(outcomes.every(result => result.rows[0].result.state === 'confirmed'));
  assert.equal(await journals(payment.order_id), 1);
  assert.equal((await balance(2)).earned, before.earned);
  assert.equal((await record(payment, 'failed')).state, 'confirmed');
  const mismatch = await confirm(payment, 'BAH_WRONG_REPLAY');
  assert.equal(mismatch.state, 'confirmed'); assert.equal(mismatch.issue_code, 'post_confirmation_mismatch');
  assert.equal(mismatch.provider_transaction_id, 'BAH_CONFIRMED_1');
  await assert.rejects(act(2, 'refund', payment.order_id), /prestador/);
  await assert.rejects(db.query("update payment_point_orders set status='refunded' where id=$1", [payment.order_id]), /prestador/);
  await assert.rejects(db.query('update payment_point_orders set seller_id=$1 where id=$2', [id(4), payment.order_id]), /prestador/);
  assert.equal((await balance(2)).earned, before.earned);
});

await test('all review states block replacement debits, including reviews without a paid observation', async () => {
  const orderId = await order(300, 700);
  let attempt = await prepare(301, orderId);
  attempt = await record(attempt, 'review', { issue: 'acceptance_identity_mismatch' });
  assert.equal(attempt.observed_paid, false);
  await assert.rejects(prepare(302, orderId), /externa/);
  await assert.rejects(appyPrepare(303, orderId), /externa/);
  await assert.rejects(act(1, 'pay', orderId), /externa/);
  await assert.rejects(act(2, 'cancel', orderId), /externa/);
  attempt = await record(attempt, 'failed', { receipt: 'BAH_REVIEW_1', paid: true, issue: 'incomplete_query' });
  assert.equal(attempt.state, 'review'); assert.equal(attempt.observed_paid, true);
  assert.equal(attempt.issue_code, 'acceptance_identity_mismatch');
  assert.equal((await confirm(attempt, 'BAH_REVIEW_1')).state, 'review');
  assert.equal(await journals(orderId), 0);
  await assert.rejects(db.query("update massa_unitel.observations set outcome='confirmed'"), /Immutable/);
});

await test('expired or modified orders retain paid evidence and reserve the receipt without automatic credit', async () => {
  const expiredId = await order(310, 800);
  const expired = await prepare(311, expiredId);
  await db.query("update payment_point_orders set expires_at=now()-interval '1 minute' where id=$1", [expiredId]);
  const result = await confirm(expired, 'BAH_EXPIRED');
  assert.equal(result.state, 'review'); assert.equal(result.observed_paid, true);
  assert.equal(result.issue_code, 'order_unavailable_after_payment');
  assert.equal(result.provider_transaction_id, 'BAH_EXPIRED');
  assert.equal(await journals(expiredId), 0);

  const anotherId = await order(312, 800);
  const another = await prepare(313, anotherId);
  const reused = await confirm(another, 'BAH_EXPIRED');
  assert.equal(reused.state, 'review'); assert.equal(reused.issue_code, 'payment_identity_mismatch');
  assert.equal(reused.provider_transaction_id, null); assert.equal(await journals(anotherId), 0);
  for (const [n, change] of [[314, 'amount=999'], [316, `seller_id='${id(4)}'`]]) {
    const orderId = await order(n, 800);
    const attempt = await prepare(n + 1, orderId);
    await db.query(`update payment_point_orders set ${change} where id=$1`, [orderId]);
    const mismatch = await confirm(attempt);
    assert.equal(mismatch.state, 'review'); assert.equal(mismatch.issue_code, 'order_changed');
    assert.equal(await journals(orderId), 0);
  }
});

await test('reference or provider identity mismatches cannot credit an order or steal another receipt', async () => {
  const wrongRef = await prepare(321, await order(320, 500));
  const mismatch = await confirm(wrongRef, 'BAH_BAD_REF', 'afm_u_other');
  assert.equal(mismatch.state, 'review'); assert.equal(mismatch.issue_code, 'payment_identity_mismatch');
  assert.equal(mismatch.provider_transaction_id, null);
  const attempt = await prepare(323, await order(322, 500));
  const crossBound = await record(attempt, 'pending', { conversation: payment.provider_conversation_id });
  assert.equal(crossBound.state, 'review'); assert.equal(crossBound.provider_conversation_id, null);
  assert.equal(await journals(attempt.order_id), 0);
  const forged = await rpc('massa_unitel_event', ['c'.repeat(64), merchant, attempt.merchant_ref, null, 'BAH_CONFIRMED_1', 0]);
  assert.equal(forged.event_id, null);
  assert.equal(await rpc('massa_unitel_find', [merchant, payment.merchant_ref, 'AG_WRONG']), null);
});

await test('contradictory authenticated paid evidence is audited without binding another payment identity', async () => {
  for (const [n, alreadyReview] of [[324, false], [326, true]]) {
    let attempt = await prepare(n + 1, await order(n, 500));
    if (alreadyReview) attempt = await record(attempt, 'review', { issue: 'query_requires_review' });
    const receipt = `BAH_FOREIGN_${n}`;
    const conversation = `AG_FOREIGN_${n}`;
    const observed = await record(attempt, 'review', {
      conversation, receipt, paid: true, issue: 'query_requires_review', bindIdentity: false,
    });
    assert.equal(observed.state, 'review'); assert.equal(observed.observed_paid, true);
    assert.equal(observed.provider_conversation_id, null); assert.equal(observed.provider_transaction_id, null);
    const evidence = (await db.query('select conversation_id,transaction_id,outcome from massa_unitel.observations where attempt_id=$1', [attempt.id])).rows;
    assert.deepEqual(evidence, [{ conversation_id: conversation, transaction_id: receipt, outcome: 'query_requires_review' }]);
    assert.equal(await journals(attempt.order_id), 0);
    await assert.rejects(prepare(n + 1000, attempt.order_id), /externa/);

    const genuine = await prepare(n + 2001, await order(n + 2000, 500));
    const bound = await record(genuine, 'pending', { conversation });
    assert.equal(bound.provider_conversation_id, conversation);
    assert.equal((await confirm(bound, receipt)).state, 'confirmed');
    assert.equal(await journals(genuine.order_id), 1);
  }
});

await test('a failed attempt may be replaced, but late successes leave both attempts in review with zero credit', async () => {
  const orderId = await order(330, 800);
  const older = await record(await prepare(331, orderId), 'failed', { issue: 'provider_declined' });
  assert.equal((await record(older, 'pending')).state, 'failed');
  const newer = await prepare(332, orderId);
  const oldPaid = await confirm(older, 'BAH_OLD');
  assert.equal(oldPaid.state, 'review'); assert.equal(oldPaid.issue_code, 'another_attempt_exists');
  const newPaid = await confirm(newer, 'BAH_NEW');
  assert.equal(newPaid.state, 'review'); assert.equal(newPaid.observed_paid, true);
  assert.equal(await journals(orderId), 0);
});

await test('active AppyPay blocks UNITEL and a normal AppyPay settlement still works after this migration', async () => {
  const orderId = await order(340, 900);
  const appy = await appyRecord(await appyPrepare(341, orderId), 'pending', id(8341));
  await assert.rejects(prepare(342, orderId), /externa/);
  const before = await balance(2);
  assert.equal((await appyConfirm(appy)).state, 'confirmed');
  assert.equal((await balance(2)).earned, before.earned + 900);
  assert.equal((await act(2, 'view', orderId)).payment_provider, 'appypay');
  await assert.rejects(prepare(342, orderId), /indisponível/);
  assert.equal(await journals(orderId), 1);
});

await test('AppyPay late success after UNITEL replacement is retained as review in both providers', async () => {
  const orderId = await order(350, 1000);
  const appy = await appyRecord(await appyPrepare(351, orderId), 'failed', id(8351));
  const unitel = await prepare(352, orderId);
  const appyLate = await appyConfirm(appy);
  assert.equal(appyLate.state, 'review'); assert.equal(appyLate.observed_paid, true);
  assert.equal(appyLate.issue_code, 'another_provider_attempt_exists');
  assert.equal((await confirm(unitel, 'BAH_CROSS_UNITEL')).state, 'review');
  assert.equal(await journals(orderId), 0);
});

await test('UNITEL late success after AppyPay replacement likewise cannot pay either provider automatically', async () => {
  const orderId = await order(360, 1100);
  const unitel = await record(await prepare(361, orderId), 'failed', { issue: 'provider_declined' });
  const appy = await appyRecord(await appyPrepare(362, orderId), 'pending', id(8362));
  const unitelLate = await confirm(unitel, 'BAH_CROSS_APPY');
  assert.equal(unitelLate.state, 'review'); assert.equal(unitelLate.observed_paid, true);
  assert.equal((await appyConfirm(appy)).state, 'review');
  assert.equal(await journals(orderId), 0);
});

await test('an AppyPay payment already posted remains auditable after late UNITEL paid evidence', async () => {
  const orderId = await order(365, 1100);
  const unitel = await record(await prepare(366, orderId), 'failed', { issue: 'provider_declined' });
  const appy = await appyRecord(await appyPrepare(367, orderId), 'pending', id(8367));
  assert.equal((await appyConfirm(appy)).state, 'confirmed');
  const before = await balance(2);
  assert.equal((await confirm(unitel, 'BAH_LATE_AFTER_APPY_PAID')).state, 'review');
  const audit = await rpc('massa_gateway_confirm', [appy.id, id(8368), appy.merchant_ref, appy.amount_minor, 'AOA', 'REF']);
  assert.equal(audit.state, 'confirmed'); assert.equal(audit.issue_code, 'post_confirmation_mismatch');
  assert.equal((await balance(2)).earned, before.earned);
  assert.equal(await journals(orderId), 1);
});

await test('late UNITEL success after a local payment never adds a second credit or bypasses passkeys', async () => {
  const orderId = await order(370, 1200);
  const unitel = await record(await prepare(371, orderId), 'failed', { issue: 'provider_declined' });
  await act(1, 'topup', id(372), 10000);
  await assert.rejects(act(1, 'pay', orderId), /chave/);
  await db.query("insert into wallet_security.approvals values($1,$2,$3,now()+interval '60 seconds')", [id(1), id(999), { action: 'pay', id: orderId, amount: 1200, destination: id(2), currency: 'AOA' }]);
  await act(1, 'pay', orderId);
  const before = await balance(2);
  const late = await confirm(unitel, 'BAH_ALREADY_LOCAL');
  assert.equal(late.state, 'review'); assert.equal(late.issue_code, 'order_unavailable_after_payment');
  assert.equal((await balance(2)).earned, before.earned);
  assert.equal(await journals(orderId), 1);
  await assert.rejects(prepare(373, orderId), /indisponível/);
});

await test('wallet access changes between submission and confirmation require review', async () => {
  const attempt = await prepare(381, await order(380, 500, 4));
  await db.query('delete from wallet_pilot_access where user_id=$1', [id(4)]);
  const result = await confirm(attempt, 'BAH_REVOKED');
  assert.equal(result.state, 'review'); assert.equal(result.issue_code, 'wallet_access_changed');
  assert.equal(result.observed_paid, true); assert.equal(await journals(attempt.order_id), 0);
  await db.query('insert into wallet_pilot_access(user_id,granted_by) values($1,$2)', [id(4), id(9)]);
});

await test('durable inbox retries failed queries, preserves hints separately and bounds hostile delivery bursts', async () => {
  const attempt = await prepare(401, await order(400, 600), { merchant: 'inbox-worker' });
  const event = await rpc('massa_unitel_event', ['d'.repeat(64), 'inbox-worker', attempt.merchant_ref, 'AG_HINT', 'BAH_HINT', 0]);
  const first = await rpc('massa_unitel_events_due', ['inbox-worker', 1, 60]);
  assert.equal(first.length, 1); assert.equal(first[0].event_id, event.event_id); assert.ok(first[0].lease_token);
  assert.equal((await rpc('massa_unitel_events_due', ['inbox-worker', 1, 60])).length, 0);
  await rpc('massa_unitel_event_done', [event.event_id, 'query_unavailable']);
  assert.equal((await db.query('select processed_at from massa_unitel.events where id=$1', [event.event_id])).rows[0].processed_at, null);
  await db.query("update massa_unitel.events set next_check_at=now()-interval '1 minute' where id=$1", [event.event_id]);
  const retried = await rpc('massa_unitel_events_due', ['inbox-worker', 1, 60]);
  assert.equal(retried[0].event_id, event.event_id); assert.notEqual(retried[0].lease_token, first[0].lease_token);
  await rpc('massa_unitel_event_done', [event.event_id, 'event_mismatch']);
  assert.equal((await rpc('massa_unitel_events_due', ['inbox-worker', 1, 60])).length, 0);
  assert.equal((await get(attempt)).provider_transaction_id, null);

  let limited;
  for (let n = 0; n < 12; n++) limited = await rpc('massa_unitel_event', [n.toString(16).padStart(64, '0'), 'inbox-worker', attempt.merchant_ref, null, `BAH_FLOOD_${n}`, 0]);
  assert.equal(limited.rate_limited, true);
  assert.equal((await db.query('select count(*)::int n from massa_unitel.events where attempt_id=$1', [attempt.id])).rows[0].n, 10);
  assert.equal((await get(attempt)).state, 'submitting');
  assert.equal((await get(attempt)).observed_paid, false);
  assert.equal(await journals(attempt.order_id), 0);
});

await test('attempt leases are bounded, merchant-scoped and recoverable after worker death', async () => {
  const attempts = [];
  for (let n = 0; n < 3; n++) attempts.push(await prepare(500 + n, await order(510 + n, 100), { merchant: 'lease-worker' }));
  await prepare(503, await order(513, 100), { merchant: 'other-worker' });
  await db.query("update massa_unitel.attempts set next_check_at=now()-interval '1 minute' where merchant in ('lease-worker','other-worker')");
  const first = await rpc('massa_unitel_due', ['lease-worker', 2, 60]);
  const second = await rpc('massa_unitel_due', ['lease-worker', 2, 60]);
  assert.equal(first.length, 2); assert.equal(second.length, 1);
  assert.equal(new Set([...first, ...second].map(attempt => attempt.id)).size, 3);
  assert.ok(first.every(attempt => attempt.merchant === 'lease-worker' && attempt.lease_token));
  assert.equal((await rpc('massa_unitel_due', ['lease-worker', 2, 60])).length, 0);
  await db.query("update massa_unitel.attempts set next_check_at=now()-interval '1 minute',lease_until=now()-interval '1 minute' where id=$1", [first[0].id]);
  const recovered = await rpc('massa_unitel_due', ['lease-worker', 1, 60]);
  assert.equal(recovered[0].id, first[0].id); assert.notEqual(recovered[0].lease_token, first[0].lease_token);
  await assert.rejects(rpc('massa_unitel_due', ['lease-worker', 101, 60]), /inválido/);
  await assert.rejects(rpc('massa_unitel_due', ['lease-worker', null, 60]), /inválido/);
  await assert.rejects(rpc('massa_unitel_events_due', ['inbox-worker', 1, 5]), /inválido/);
});

await test('ledger immutability, balanced journals and private passkey wrappers remain intact', async () => {
  assert.equal((await db.query('select journal_id from payment_point_entries group by journal_id having sum(amount)<>0')).rows.length, 0);
  await assert.rejects(db.query('update payment_point_entries set amount=1'), /Immutable/);
  await asRole('authenticated', async () => {
    await assert.rejects(db.query('update payment_point_orders set payment_provider=null'), /permission denied/);
    await assert.rejects(db.query("select payment_point_private.massa_action_impl('topup',null,100,null)"), /permission denied/);
  }, 1);
  const orderId = await order(600, 100);
  await assert.rejects(db.query("update payment_point_orders set status='paid',buyer_id=$1,payment_provider='unitel' where id=$2", [id(1), orderId]), /Confirmação externa/);
});

await db.close();
