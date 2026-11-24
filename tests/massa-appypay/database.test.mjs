import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const merchant = 'sandbox-merchant-test';
const migration = 'supabase/migrations/20261122120553_massa_appypay_sandbox.sql';
await db.exec(`
  create role anon; create role authenticated; create role service_role;
  create schema auth;
  create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  create table auth.users(id uuid primary key, email text);
  create table public.profiles(id uuid primary key, display_name text, username text, country_code text);
  create function public.has_role(uuid,text) returns boolean language sql as $$select $1='${id(9)}'::uuid$$;
  grant usage on schema auth to authenticated, service_role;
  create table public.kumbu_purchases(id uuid primary key, user_id uuid references auth.users(id));
`);
for (const n of [1, 2, 3, 4, 5, 9]) {
  await db.query('insert into auth.users(id) values($1)', [id(n)]);
  await db.query("insert into profiles(id,username,country_code) values($1,$2,'AO')", [id(n), `tester${n}`]);
}
for (const name of [
  '20261118163926_payment_point_sandbox.sql',
  '20261118164605_payment_point_function_hardening.sql',
  '20261118170009_payment_point_angola.sql',
  '20261118193500_payment_point_balance_rls.sql',
  '20261119011000_wallet_private_pilot.sql',
  '20261119011500_wallet_pilot_recipient.sql',
  '20261119040000_wallet_passkey_state.sql',
  '20261119235000_wallet_debit_authorization.sql',
]) await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'));
await db.exec(readFileSync(migration, 'utf8'));
await db.query('insert into wallet_pilot_access(user_id,granted_by) select id,$1 from auth.users where id<>$2', [id(9), id(5)]);

async function asRole(role, callback, user = null) {
  await db.exec(`set role ${role}; set request.jwt.claim.sub='${user ? id(user) : ''}'; set request.jwt.claims='${JSON.stringify({ session_id: id(999), aal: 'aal2' })}'`);
  try { return await callback(); } finally { await db.exec('reset role'); }
}
async function rpc(name, values = []) {
  const args = values.map((_, n) => `$${n + 1}`).join(',');
  return asRole('service_role', async () => (await db.query(`select public.${name}(${args}) result`, values)).rows[0].result);
}
async function act(user, action, reference = null, amount = null, text = null) {
  return asRole('authenticated', async () => (await db.query('select public.payment_point_action($1,$2,$3,$4) result', [action, reference, amount, text])).rows[0].result, user);
}
async function order(n, amount = 12345, seller = 2) {
  await act(seller, 'merchant');
  await act(seller, 'create', id(n), amount, `Test order ${n}`);
  return id(n);
}
async function prepare(request, orderId, extra = {}) {
  return rpc('massa_gateway_prepare', [id(extra.actor ?? 1), id(request), extra.method ?? 'REF', extra.phone ?? null,
    extra.merchant ?? merchant, orderId, extra.amount ?? null]);
}
async function record(attempt, state = 'pending', charge = id(8000), code = 101) {
  return rpc('massa_gateway_record', [attempt.id, charge, state, code, null, '123456789', '00123', null]);
}
async function confirm(attempt, extra = {}) {
  return rpc('massa_gateway_confirm', [attempt.id, extra.charge ?? attempt.provider_charge_id ?? id(8000),
    extra.ref ?? attempt.merchant_ref, extra.amount ?? attempt.amount_minor, extra.currency ?? 'AOA', extra.method ?? attempt.method]);
}
const balance = async user => (await act(user, 'overview')).wallet;
const journals = async reference => (await db.query('select count(*)::int n from payment_point_private.journals where reference=$1', [reference])).rows[0].n;

await test('service-only RPCs and private RLS tables reject direct client access', async () => {
  for (const role of ['anon', 'authenticated']) {
    await asRole(role, async () => {
      await assert.rejects(db.query('select public.massa_gateway_prepare($1,$2,$3,$4,$5,$6,$7)', [id(1), id(100), 'REF', null, merchant, null, 100]), /permission denied/);
      await assert.rejects(db.query('select public.massa_gateway_confirm($1,$2,$3,$4,$5,$6)', [id(100), id(8000), 'M123', 100, 'AOA', 'REF']), /permission denied/);
      await assert.rejects(db.query('select public.massa_gateway_due($1)', [merchant]), /permission denied/);
      await assert.rejects(db.query('select * from massa_gateway.attempts'), /permission denied/);
    }, 1);
  }
  await asRole('service_role', () => assert.rejects(db.query('select * from massa_gateway.attempts'), /permission denied/));
  const schema = (await db.query("select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='massa_gateway' and c.relkind='r'")).rows;
  assert.equal(schema.length, 3);
  assert.ok(schema.every(table => table.relrowsecurity));
});

await test('preparation derives order amount and recipient and enforces pilot, geography, channel and expiry', async () => {
  const orderId = await order(101);
  await assert.rejects(prepare(201, orderId, { actor: 2 }), /indisponível/);
  await assert.rejects(prepare(201, orderId, { actor: 5 }), /reservado/);
  await assert.rejects(prepare(201, orderId, { amount: 1 }), /servidor/);
  await assert.rejects(prepare(201, orderId, { method: 'UNITEL' }), /inválida/);
  await assert.rejects(prepare(201, orderId, { method: 'GPO', phone: '912345678' }), /Telefone/);
  await db.query("update profiles set country_code='PT' where id=$1", [id(1)]);
  await assert.rejects(prepare(201, orderId), /Angola/);
  await db.query("update profiles set country_code='AO' where id=$1", [id(1)]);
  await db.query("update payment_point_orders set expires_at=now()-interval '1 minute' where id=$1", [orderId]);
  await assert.rejects(prepare(201, orderId), /indisponível/);
  await assert.rejects(prepare(202, null, { amount: 100000001 }), /inválido/);
  assert.equal(await journals(orderId), 0);
});

let payment;
await test('a stable request is posted once and an active order prevents a second charge under a new request', async () => {
  const orderId = await order(102);
  payment = await prepare(202, orderId);
  assert.equal(payment.submit, true);
  assert.equal(payment.state, 'submitting');
  assert.equal(payment.amount_minor, 12345);
  assert.equal(payment.beneficiary_id, id(2));
  assert.equal(payment.environment, 'sandbox');
  assert.match(payment.merchant_ref, /^[A-Za-z0-9]{1,15}$/);
  const retry = await prepare(202, orderId);
  assert.equal(retry.id, payment.id); assert.equal(retry.submit, false);
  await assert.rejects(prepare(202, orderId, { merchant: 'another-merchant' }), /idempotente/);
  await assert.rejects(prepare(203, orderId), /em curso/);
  await assert.rejects(prepare(204, orderId, { actor: 3 }), /em curso/);
  await assert.rejects(act(1, 'pay', orderId), /externa/);
  await assert.rejects(act(2, 'cancel', orderId), /externa/);
  await assert.rejects(db.query("update payment_point_orders set status='cancelled' where id=$1", [orderId]), /externa/);
});

await test('lost create response stays uncertain, can be recovered by request ID, and cannot authorise a repost', async () => {
  payment = await rpc('massa_gateway_record', [payment.id, null, 'uncertain', null, 'create_timeout']);
  assert.equal(payment.state, 'uncertain');
  const recovered = await rpc('massa_gateway_get', [id(1), null, null, id(202)]);
  assert.equal(recovered.id, payment.id);
  assert.equal((await prepare(202, payment.order_id)).submit, false);
  await assert.rejects(prepare(205, payment.order_id), /em curso/);
  await assert.rejects(rpc('massa_gateway_get', [id(3), payment.id]), /permissão/);
  assert.equal((await rpc('massa_gateway_get', [id(2), null, payment.order_id])).id, payment.id);
  assert.equal(await journals(payment.order_id), 0);
});

await test('reference generation is pending and only verified confirmation can post an atomic balanced payment', async () => {
  payment = await record(payment);
  assert.equal(payment.state, 'pending'); assert.equal(payment.reference, '123456789');
  assert.equal(await journals(payment.order_id), 0);
  await assert.rejects(rpc('massa_gateway_record', [payment.id, id(8000), 'confirmed']), /inválido/);
  const before = await balance(2);
  const paid = await confirm(payment);
  assert.equal(paid.state, 'confirmed'); assert.equal(paid.observed_paid, true);
  assert.equal((await balance(2)).earned, before.earned + payment.amount_minor);
  const view = await act(2, 'view', payment.order_id);
  assert.equal(view.status, 'paid'); assert.equal(view.payment_provider, 'appypay');
  assert.equal(await journals(payment.order_id), 1);
  const entries = (await db.query('select user_id,account,amount from payment_point_entries where reference=$1 order by amount', [payment.order_id])).rows;
  assert.equal(entries.length, 2);
  assert.equal(entries[0].account, 'clearing'); assert.equal(Number(entries[0].amount), -payment.amount_minor);
  assert.equal(entries[1].account, 'earned'); assert.equal(Number(entries[1].amount), payment.amount_minor);
});

await test('overlapping replays are single-use, out-of-order failures do not undo payment, and PSP refund cannot use the internal path', async () => {
  const before = await balance(2);
  await asRole('service_role', async () => {
    const params = [payment.id, payment.provider_charge_id, payment.merchant_ref, payment.amount_minor, 'AOA', 'REF'];
    const outcomes = await Promise.all([db.query('select public.massa_gateway_confirm($1,$2,$3,$4,$5,$6) result', params), db.query('select public.massa_gateway_confirm($1,$2,$3,$4,$5,$6) result', params)]);
    assert.ok(outcomes.every(result => result.rows[0].result.state === 'confirmed'));
  });
  assert.equal((await balance(2)).earned, before.earned);
  assert.equal(await journals(payment.order_id), 1);
  assert.equal((await record(payment, 'failed')).state, 'confirmed');
  await assert.rejects(act(2, 'refund', payment.order_id), /prestador/);
  await assert.rejects(db.query("update payment_point_orders set status='refunded' where id=$1", [payment.order_id]), /prestador/);
  assert.equal((await balance(2)).earned, before.earned);
});

await test('amount, currency, method and charge identity mismatches preserve evidence in review without funds', async () => {
  const variants = [{ amount: 1 }, { currency: 'USD' }, { method: 'GPO' }, { charge: id(8999) }];
  for (let n = 0; n < variants.length; n++) {
    const orderId = await order(300 + n, 20000);
    const attempt = await record(await prepare(400 + n, orderId), 'pending', id(8100 + n));
    const checked = await confirm(attempt, variants[n]);
    assert.equal(checked.state, 'review'); assert.equal(checked.observed_paid, true);
    assert.equal(checked.issue_code, 'payment_identity_mismatch');
    assert.equal(checked.provider_charge_id, id(8100 + n));
    assert.equal(await journals(orderId), 0);
    assert.equal((await act(2, 'view', orderId)).status, 'pending');
    assert.equal((await confirm(attempt)).state, 'review');
    await assert.rejects(prepare(500 + n, orderId), /em curso/);
  }
  assert.equal((await db.query("select count(*)::int n from massa_gateway.observations where outcome='payment_identity_mismatch'")).rows[0].n >= 4, true);
  await assert.rejects(db.query("update massa_gateway.observations set outcome='confirmed'"), /immutable/);
});

await test('a late success on an expired or already internally paid order is retained for review, not credited twice', async () => {
  const expiredOrder = await order(600, 500);
  const expired = await record(await prepare(601, expiredOrder), 'pending', id(8200));
  await db.query("update payment_point_orders set expires_at=now()-interval '1 minute' where id=$1", [expiredOrder]);
  const result = await confirm(expired);
  assert.equal(result.state, 'review'); assert.equal(result.observed_paid, true);
  assert.equal(result.issue_code, 'order_unavailable_after_payment');
  assert.equal(await journals(expiredOrder), 0);

  const internalOrder = await order(602, 700);
  const failed = await record(await prepare(603, internalOrder), 'failed', id(8201), 200);
  await act(1, 'topup', id(604), 10000);
  await assert.rejects(act(1, 'pay', internalOrder), /chave/);
  await db.query("insert into wallet_security.approvals values($1,$2,$3,now()+interval '60 seconds')", [id(1), id(999), { action: 'pay', id: internalOrder, amount: 700, destination: id(2), currency: 'AOA' }]);
  await act(1, 'pay', internalOrder);
  const before = await balance(2);
  const late = await confirm(failed);
  assert.equal(late.state, 'review'); assert.equal(late.observed_paid, true);
  assert.equal((await balance(2)).earned, before.earned);
  assert.equal(await journals(internalOrder), 1);
});

await test('external topup cannot be manually fulfilled, uses cents, and never credits spendable funds twice', async () => {
  let topup = await prepare(700, null, { amount: 1234 });
  assert.equal(topup.purpose, 'topup'); assert.equal(topup.beneficiary_id, id(1));
  await assert.rejects(prepare(700, null, { amount: 1235 }), /idempotente/);
  await assert.rejects(act(1, 'topup', topup.id, 1234), /reservada/);
  topup = await record(topup, 'pending', id(8300));
  const before = await balance(1);
  assert.equal((await confirm(topup)).state, 'confirmed');
  await confirm(topup);
  assert.equal((await balance(1)).purchased, before.purchased + 1234);
  assert.equal((await balance(1)).earned, before.earned);
  assert.equal(await journals(topup.id), 1);
  const found = await rpc('massa_gateway_find', [merchant, id(8300), null]);
  assert.equal(found.id, topup.id);
  assert.equal(await rpc('massa_gateway_find', ['different-merchant', id(8300), topup.merchant_ref]), null);
});

await test('late success of an older failed attempt coexists with a newer attempt as review evidence without duplicate funds', async () => {
  const orderId = await order(710, 800);
  const older = await record(await prepare(711, orderId), 'failed', id(8310), 200);
  const newer = await record(await prepare(712, orderId), 'pending', id(8311), 101);
  const olderResult = await confirm(older);
  assert.equal(olderResult.state, 'review'); assert.equal(olderResult.observed_paid, true);
  assert.equal(olderResult.issue_code, 'another_attempt_exists');
  const newerResult = await confirm(newer);
  assert.equal(newerResult.state, 'review'); assert.equal(newerResult.observed_paid, true);
  assert.equal(await journals(orderId), 0);
  assert.equal((await db.query('select count(*)::int n from massa_gateway.observations where attempt_id in ($1,$2)', [older.id, newer.id])).rows[0].n, 2);
});

await test('incomplete trusted paid responses preserve evidence even when the attempt already requires review', async () => {
  let attempt = await prepare(720, null, { amount: 300 });
  attempt = await rpc('massa_gateway_record', [attempt.id, null, 'review', null, 'incomplete_response']);
  assert.equal(attempt.observed_paid, false);
  attempt = await rpc('massa_gateway_record', [attempt.id, id(8320), 'review', 100, 'charge_mismatch', null, null, null, true]);
  assert.equal(attempt.state, 'review'); assert.equal(attempt.observed_paid, true);
  assert.equal(await journals(attempt.id), 0);
  assert.equal((await db.query('select charge_id from massa_gateway.observations where attempt_id=$1', [attempt.id])).rows[0].charge_id, id(8320));
});

await test('a seller can inspect the order state without receiving the payer telephone and concurrent creation elects one submitter', async () => {
  const orderId = await order(730, 900);
  const attempt = await prepare(731, orderId, { method: 'GPO', phone: '900000000' });
  assert.equal((await rpc('massa_gateway_get', [id(1), attempt.id])).phone, '900000000');
  assert.equal((await rpc('massa_gateway_get', [id(2), null, orderId])).phone, null);
  const parallelOrder = await order(732, 900);
  await asRole('service_role', async () => {
    const params = [id(1), id(733), 'REF', null, merchant, parallelOrder, null];
    const outcomes = await Promise.all([db.query('select public.massa_gateway_prepare($1,$2,$3,$4,$5,$6,$7) result', params), db.query('select public.massa_gateway_prepare($1,$2,$3,$4,$5,$6,$7) result', params)]);
    assert.equal(outcomes.filter(outcome => outcome.rows[0].result.submit).length, 1);
    assert.equal(outcomes[0].rows[0].result.id, outcomes[1].rows[0].result.id);
  });
});

await test('webhook inbox deduplicates deliveries and records completion separately from ledger settlement', async () => {
  const hash = 'a'.repeat(64);
  const first = await rpc('massa_gateway_event', [hash, merchant, payment.provider_charge_id, payment.merchant_ref, 100]);
  assert.equal(first.duplicate, false); assert.equal(first.attempt_id, payment.id);
  const retry = await rpc('massa_gateway_event', [hash, merchant, payment.provider_charge_id, payment.merchant_ref, 100]);
  assert.equal(retry.duplicate, true); assert.equal(retry.event_id, first.event_id);
  await rpc('massa_gateway_event_done', [first.event_id, null]);
  assert.ok((await rpc('massa_gateway_event', [hash, merchant, payment.provider_charge_id, payment.merchant_ref, 100])).processed_at);
  const unknown = await rpc('massa_gateway_event', ['b'.repeat(64), merchant, id(8998), 'Unknown', 100]);
  assert.equal(unknown.attempt_id, null); assert.equal(unknown.event_id, null);
  assert.equal((await db.query('select count(*)::int n from massa_gateway.events where event_hash=$1', ['b'.repeat(64)])).rows[0].n, 0);
  const conflicting = await rpc('massa_gateway_event', ['c'.repeat(64), merchant, id(8998), payment.merchant_ref, 100]);
  assert.equal(conflicting.event_id, null);
  const unbound = await prepare(799, null, { amount: 100 });
  const crossBound = await rpc('massa_gateway_event', ['e'.repeat(64), merchant, payment.provider_charge_id, unbound.merchant_ref, 100]);
  assert.equal(crossBound.event_id, null);
  assert.equal((await rpc('massa_gateway_find', [merchant, null, null, payment.id])).id, payment.id);
  assert.equal(await journals(payment.order_id), 1);
});

await test('a durable callback can recover a lost create response after a failed GET without binding untrusted IDs', async () => {
  const attempt = await prepare(800, null, { amount: 600, merchant: 'event-worker' });
  const event = await rpc('massa_gateway_event', ['d'.repeat(64), 'event-worker', id(8400), attempt.merchant_ref, 100]);
  assert.equal(event.attempt_id, attempt.id);
  assert.equal((await rpc('massa_gateway_get', [id(1), attempt.id])).provider_charge_id, null);
  const leased = await rpc('massa_gateway_events_due', ['event-worker', 25, 60]);
  assert.equal(leased.length, 1); assert.equal(leased[0].event_id, event.event_id);
  assert.equal(leased[0].charge_id, id(8400)); assert.ok(leased[0].lease_token);
  assert.equal((await rpc('massa_gateway_events_due', ['event-worker', 25, 60])).length, 0);
  await rpc('massa_gateway_event_done', [event.event_id, 'query_unavailable']);
  const retried = await rpc('massa_gateway_event', ['d'.repeat(64), 'event-worker', id(8400), attempt.merchant_ref, 100]);
  assert.equal(retried.duplicate, true); assert.equal(retried.processed_at, null);
  await db.query("update massa_gateway.events set next_check_at=now()-interval '1 minute' where id=$1", [event.event_id]);
  const recovered = await rpc('massa_gateway_events_due', ['event-worker', 1, 60]);
  assert.equal(recovered.length, 1); assert.equal(recovered[0].attempt_id, attempt.id);
  const verified = await confirm(attempt, { charge: recovered[0].charge_id });
  assert.equal(verified.state, 'confirmed');
  await rpc('massa_gateway_event_done', [event.event_id, null]);
  assert.equal((await rpc('massa_gateway_events_due', ['event-worker', 25, 60])).length, 0);
  assert.equal(await journals(attempt.id), 1);
});

await test('known callback flooding is bounded without changing financial state or retaining unknown events', async () => {
  const attempt = await prepare(810, null, { amount: 100, merchant: 'event-flood-test' });
  let result;
  for (let n = 0; n < 14; n++) {
    const hash = n.toString(16).padStart(64, '0');
    result = await rpc('massa_gateway_event', [hash, 'event-flood-test', id(8500 + n), attempt.merchant_ref, 100]);
  }
  assert.equal(result.rate_limited, true);
  assert.equal((await db.query('select count(*)::int n from massa_gateway.events where attempt_id=$1', [attempt.id])).rows[0].n, 10);
  const unchanged = await rpc('massa_gateway_get', [id(1), attempt.id]);
  assert.equal(unchanged.state, 'submitting'); assert.equal(unchanged.observed_paid, false); assert.equal(unchanged.provider_charge_id, null);
  assert.equal(await journals(attempt.id), 0);
});

await test('mismatched callback hints finish only their inbox entry while query failures remain retryable', async () => {
  const attempt = await prepare(820, null, { amount: 100, merchant: 'event-terminal-test' });
  for (const [n, issue] of ['event_mismatch', 'attempt_not_found', 'query_unavailable'].entries()) {
    const hash = (20 + n).toString(16).padStart(64, '0');
    const event = await rpc('massa_gateway_event', [hash, 'event-terminal-test', id(8600 + n), attempt.merchant_ref, 100]);
    await rpc('massa_gateway_event_done', [event.event_id, issue]);
    const row = (await db.query('select processed_at,issue_code from massa_gateway.events where id=$1', [event.event_id])).rows[0];
    assert.equal(row.issue_code, issue);
    assert.equal(row.processed_at !== null, issue !== 'query_unavailable');
  }
  const unchanged = await rpc('massa_gateway_get', [id(1), attempt.id]);
  assert.equal(unchanged.state, 'submitting'); assert.equal(unchanged.observed_paid, false);
  assert.equal(await journals(attempt.id), 0);
});

await test('reconciliation leases are merchant-scoped, bounded and recover after lease expiry', async () => {
  const attempts = [];
  for (let n = 0; n < 3; n++) attempts.push(await prepare(900 + n, null, { amount: 100, merchant: 'worker-test' }));
  await prepare(904, null, { amount: 100, merchant: 'other-worker' });
  await db.query("update massa_gateway.attempts set next_check_at=now()-interval '1 minute' where merchant in ('worker-test','other-worker')");
  const first = await rpc('massa_gateway_due', ['worker-test', 2, 60]);
  assert.equal(first.length, 2); assert.ok(first.every(attempt => attempt.merchant === 'worker-test' && attempt.lease_token));
  const second = await rpc('massa_gateway_due', ['worker-test', 2, 60]);
  assert.equal(second.length, 1);
  assert.equal(new Set([...first, ...second].map(attempt => attempt.id)).size, 3);
  assert.equal((await rpc('massa_gateway_due', ['worker-test', 2, 60])).length, 0);
  await db.query("update massa_gateway.attempts set lease_until=now()-interval '1 minute',next_check_at=now()-interval '1 minute' where id=$1", [first[0].id]);
  const recovered = await rpc('massa_gateway_due', ['worker-test', 1, 60]);
  assert.equal(recovered[0].id, first[0].id); assert.notEqual(recovered[0].lease_token, first[0].lease_token);
  await assert.rejects(rpc('massa_gateway_due', ['worker-test', 101, 60]), /inválido/);
});

await test('wallet security wrapper, immutable ledger and balanced accounting remain intact', async () => {
  assert.equal((await db.query('select journal_id from payment_point_entries group by journal_id having sum(amount)<>0')).rows.length, 0);
  await assert.rejects(db.query('update payment_point_entries set amount=1'), /Immutable/);
  await asRole('authenticated', () => assert.rejects(db.query("select payment_point_private.massa_action_impl('topup',null,100,null)"), /permission denied/), 1);
  await asRole('authenticated', () => assert.rejects(db.query('update payment_point_orders set payment_provider=null'), /permission denied/), 1);
});

await db.close();
