import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createGatewayHandlers } from '../../supabase/functions/massa-appypay/handler.ts';
import { GatewayError, SANDBOX_RESOURCE, normalizeCharge } from '../../supabase/functions/_shared/massa-appypay.ts';

// This fixture exercises the real named RPC contract used by supabase-js. The
// payment network is fully stubbed; no credentials or external services are used.
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
for (const n of [1, 2, 3, 9]) {
  await db.query('insert into auth.users(id) values($1)', [id(n)]);
  await db.query("insert into profiles(id,username,country_code) values($1,$2,'AO')", [id(n), `fixture${n}`]);
}
for (const file of [
  '20261118163926_payment_point_sandbox.sql', '20261118164605_payment_point_function_hardening.sql',
  '20261118170009_payment_point_angola.sql', '20261118193500_payment_point_balance_rls.sql',
  '20261119011000_wallet_private_pilot.sql', '20261119011500_wallet_pilot_recipient.sql',
  '20261119040000_wallet_passkey_state.sql', '20261119235000_wallet_debit_authorization.sql',
  '20261122120553_massa_appypay_sandbox.sql',
]) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
await db.query('insert into wallet_pilot_access(user_id,granted_by) select id,$1 from auth.users', [id(9)]);

const sqlErrors = [];
const store = { async rpc(name, args) {
  assert.match(name, /^massa_gateway_[a-z_]+$/);
  for (const key of Object.keys(args)) assert.match(key, /^p_[a-z_]+$/);
  const bindings = Object.keys(args).map((key, index) => `${key} => $${index + 1}`).join(', ');
  await db.exec('set role service_role');
  try { return (await db.query(`select public.${name}(${bindings}) result`, Object.values(args))).rows[0].result; }
  catch (error) {
    sqlErrors.push({ name, message: error.message });
    if (error.code === '42501') throw new GatewayError('access_denied');
    if (['P0001', '22023', '23505', '23514', '23503'].includes(error.code)) throw new GatewayError('request_rejected');
    throw new GatewayError('storage_unavailable');
  } finally { await db.exec('reset role'); }
} };
async function walletAction(user, action, reference = null, amount = null, label = null) {
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(user)}'; set request.jwt.claims='${JSON.stringify({ session_id: id(999), aal: 'aal2' })}'`);
  try { return (await db.query('select public.payment_point_action($1,$2,$3,$4) result', [action, reference, amount, label])).rows[0].result; }
  finally { await db.exec('reset role'); }
}
const config = {
  clientId: id(10), clientSecret: 'fake-server-secret', resource: SANDBOX_RESOURCE,
  merchant: 'MASSA_INTEGRATION_TEST', gpoKey: `GPO_${id(11)}`, refKey: `REF_${id(12)}`,
  allowedUsers: new Set([id(1), id(2), id(3)]), allowedOrigins: new Set(['https://sandbox.example.test']),
  webhookMode: 'verify-by-query', webhookToken: '', reconcileToken: 'fake-reconcile-token-longer-than-32-characters',
};
const external = new Map();
const deferred = [];
let nextCharge = 5000, postCalls = 0, getCalls = 0, failNextPost = false, failNextGet = false;
const gateway = {
  async create(attempt) {
    postCalls++;
    const chargeId = id(nextCharge++);
    external.set(chargeId, { attempt: { ...attempt }, paid: false });
    if (failNextPost) { failNextPost = false; throw new GatewayError('creation_uncertain', true); }
    // The documented POST response can omit the full verification fields.
    return normalizeCharge({ id: chargeId, responseStatus: { code: 101, status: 'Success', successful: true, source: attempt.method,
      reference: attempt.method === 'REF' ? { entity: '00348', referenceNumber: String(nextCharge).padStart(9, '0') } : undefined } });
  },
  async get(chargeId) {
    getCalls++;
    if (failNextGet) { failNextGet = false; throw new GatewayError('query_unavailable'); }
    const charge = external.get(chargeId);
    if (!charge) throw new GatewayError('query_unavailable');
    const a = charge.attempt;
    return normalizeCharge({ id: chargeId, merchantTransactionId: a.merchant_ref, amount: a.amount_minor / 100, currency: 'AOA',
      responseStatus: { code: charge.paid ? 100 : 101, status: 'Success', successful: true, source: a.method } });
  },
};
const handlers = createGatewayHandlers({ config, origins: config.allowedOrigins, store, gateway,
  actor: async req => req.headers.get('x-test-actor') ?? id(1),
  defer: promise => { deferred.push(promise); },
});
const req = (body, headers = {}) => new Request('https://sandbox.example.test/function', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});
async function call(body, user = 1) {
  const response = await handlers.user(req(body, { 'x-test-actor': id(user) }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify({ result, sqlErrors: sqlErrors.slice(-2) }));
  return result;
}
const drain = async () => { await Promise.all(deferred); };
const credits = async user => (await walletAction(user, 'overview')).wallet;

await test('GPO creates through named RPCs, survives combined status identifiers and credits exactly once', async () => {
  const baseline = await credits(1);
  const created = await call({ action: 'create', requestId: id(1001), method: 'GPO', phone: '900000000', amountMinor: 12345 });
  assert.equal(created.attempt.state, 'pending');
  assert.equal((await credits(1)).purchased, baseline.purchased);
  external.get(created.attempt.provider_charge_id).paid = true;
  const checked = await call({ action: 'status', requestId: id(1001), attemptId: created.attempt.id });
  assert.equal(checked.attempt.state, 'confirmed');
  assert.equal((await credits(1)).purchased, baseline.purchased + 12345);
  await call({ action: 'status', requestId: id(1001), attemptId: created.attempt.id });
  assert.equal((await credits(1)).purchased, baseline.purchased + 12345);
});

await test('REF order derives the amount and seller in SQL, with actor/seller status access and outsider rejection', async () => {
  await walletAction(2, 'merchant');
  await walletAction(2, 'create', id(2001), 54321, 'Integration test order');
  const baseline = await credits(2);
  const created = await call({ action: 'create', requestId: id(1002), orderId: id(2001), amountMinor: 1, method: 'REF' });
  assert.equal(created.attempt.amount_minor, 54321);
  external.get(created.attempt.provider_charge_id).paid = true;
  const checked = await call({ action: 'status', orderId: id(2001), requestId: id(1002), attemptId: created.attempt.id });
  assert.equal(checked.attempt.state, 'confirmed');
  const sellerView = await call({ action: 'status', orderId: id(2001), attemptId: created.attempt.id }, 2);
  assert.equal(sellerView.attempt.state, 'confirmed');
  assert.equal(Object.hasOwn(sellerView.attempt, 'phone'), false);
  assert.equal((await credits(2)).earned, baseline.earned + 54321);
  const outsider = await handlers.user(req({ action: 'status', attemptId: created.attempt.id }, { 'x-test-actor': id(3) }));
  assert.equal(outsider.status, 403);
  const order = await walletAction(2, 'view', id(2001));
  assert.equal(order.payment_provider, 'appypay');
});

await test('lost POST ID can be recovered by an authorised operator using the real find RPC signature', async () => {
  failNextPost = true;
  const priorPosts = postCalls;
  const created = await call({ action: 'create', requestId: id(1003), method: 'GPO', phone: '900000000', amountMinor: 100 });
  assert.equal(created.attempt.state, 'uncertain');
  assert.equal(created.attempt.provider_charge_id, null);
  const [chargeId, charge] = [...external.entries()].find(([, value]) => value.attempt.id === created.attempt.id);
  charge.paid = true;
  const response = await handlers.reconcile(req({ attemptId: created.attempt.id, chargeId }, { 'x-massa-reconcile-token': config.reconcileToken }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify({ result, sqlErrors: sqlErrors.slice(-2) }));
  assert.equal(result.attempt.state, 'confirmed');
  assert.equal(postCalls, priorPosts + 1);
});

await test('durable callback inbox recovers a lost charge ID after GET outage without requiring another delivery', async () => {
  failNextPost = true;
  const created = await call({ action: 'create', requestId: id(1004), method: 'REF', amountMinor: 125 });
  const [chargeId, charge] = [...external.entries()].find(([, value]) => value.attempt.id === created.attempt.id);
  charge.paid = true;
  failNextGet = true;
  const callback = { id: chargeId, merchantTransactionId: charge.attempt.merchant_ref, responseStatus: { code: 100, status: 'Success', successful: true } };
  assert.equal((await handlers.webhook(req(callback))).status, 200);
  await drain();
  const before = (await db.query('select state,provider_charge_id from massa_gateway.attempts where id=$1', [created.attempt.id])).rows[0];
  assert.equal(before.provider_charge_id, null);
  // Advance only the scheduled retry in the isolated fixture; do not sleep or
  // bypass reconciliation. The previous failure deliberately backed it off.
  await db.query("update massa_gateway.events set next_check_at=clock_timestamp()-interval '1 second' where attempt_id=$1", [created.attempt.id]);
  const response = await handlers.reconcile(req({}, { 'x-massa-reconcile-token': config.reconcileToken }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify({ result, sqlErrors: sqlErrors.slice(-2) }));
  const after = (await db.query('select state,provider_charge_id from massa_gateway.attempts where id=$1', [created.attempt.id])).rows[0];
  assert.equal(after.state, 'confirmed');
  assert.equal(after.provider_charge_id, chargeId);
  assert.ok(getCalls > 0);
});

await db.close();
