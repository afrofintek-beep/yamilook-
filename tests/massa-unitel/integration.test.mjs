import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyHarness } from '../massa-appypay/fixtures/harness.mjs';
import { SandboxUnitelMoney, UnitelError } from '../../supabase/functions/_shared/massa-unitel.ts';
import { createUnitelHandlers } from '../../supabase/functions/massa-unitel/handler.ts';

// Real HTTP handlers, adapter and named SQL RPCs; only the UNITEL network is fake.
// No provider credential, project connection or network request is used here.
const db = new PGlite();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
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
for (const n of [1, 2, 3, 9]) {
  await db.query('insert into auth.users(id,email) values($1,$2)', [id(n), `unitel-integration-${n}@example.invalid`]);
  await db.query("insert into profiles(id,display_name,username,country_code) values($1,$2,$2,'AO')", [id(n), `integration${n}`]);
}
await db.query("insert into user_roles(user_id,role) values($1,'admin')", [id(9)]);
await db.query('insert into wallet_pilot_access(user_id,granted_by) select id,$1 from auth.users', [id(9)]);

// One PGlite connection: serialize session role changes even when callbacks and
// browser requests overlap. Financial deduplication still runs in real SQL.
let databaseTail = Promise.resolve();
function inDatabase(work, role = null, actor = null) {
  const run = databaseTail.then(async () => {
    if (role) await db.exec(`set role ${role}; set request.jwt.claim.sub='${actor ?? ''}'; set request.jwt.claims='${JSON.stringify({ session_id: id(999), aal: 'aal2' })}'`);
    try { return await work(); } finally { if (role) await db.exec('reset role'); }
  });
  databaseTail = run.catch(() => {});
  return run;
}
const sqlErrors = [];
const store = { async rpc(name, args) {
  assert.match(name, /^massa_(unitel|gateway)_[a-z_]+$/);
  for (const key of Object.keys(args)) assert.match(key, /^p_[a-z_]+$/);
  return inDatabase(async () => {
    try {
      const bindings = Object.keys(args).map((key, i) => `${key} => $${i + 1}`).join(', ');
      return (await db.query(`select public.${name}(${bindings}) result`, Object.values(args))).rows[0].result;
    } catch (error) {
      sqlErrors.push({ name, code: error.code, message: error.message });
      if (error.code === '42501') throw new UnitelError('access_denied');
      if (['P0001', '22023', '23505', '23514', '23503'].includes(error.code)) throw new UnitelError('request_rejected');
      throw new UnitelError('storage_unavailable');
    }
  }, 'service_role');
} };
const wallet = (user, action, reference = null, amount = null, text = null) => inDatabase(async () =>
  (await db.query('select public.payment_point_action($1,$2,$3,$4) result', [action, reference, amount, text])).rows[0].result, 'authenticated', id(user));
async function order(n, amount = 12345) {
  await wallet(2, 'merchant'); await wallet(2, 'create', id(n), amount, `UNITEL integration ${n}`); return id(n);
}
const config = {
  clientId: 'fake-client', clientSecret: 'fake-secret', tokenUrl: 'https://sandbox.unitel.co.ao/oauth2/token',
  apiBaseUrl: 'https://sandbox.unitel.co.ao/v2/partners/1.0.0', allowedHosts: new Set(['sandbox.unitel.co.ao']),
  operator: 'fake-operator', securityCredential: 'fake-encrypted-pin', merchant: 'UNITEL_INTEGRATION_TEST', posDeviceId: 'TEST_POS',
  callbackUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/massa-unitel-webhook',
  allowedUsers: new Set([id(1), id(2), id(3)]), allowedBeneficiaries: new Set([id(2)]),
  allowedPhones: new Set(['923000001']), allowedOrigins: new Set(['https://sandbox.example.test']),
  reconcileToken: 'fake-reconcile-token-more-than-32-characters',
};
const provider = new Map(), network = [], deferred = [];
let loseNextCreation = false;
const fakeFetch = async (url, options) => {
  assert.equal(options.redirect, 'error');
  if (url === config.tokenUrl) return Response.json({ access_token: 'fake-access-token', token_type: 'Bearer', expires_in: 3600 });
  const body = JSON.parse(options.body); network.push({ url, body });
  if (url.endsWith('/buyGoods_async')) {
    const rec = body.BuyGoodRec;
    const sequence = provider.size + 1;
    const item = { merchantRef: rec.OriginatorConversationID, conversationId: `AG_${sequence}`, receipt: `RECEIPT_${sequence}`, paid: false, queryUnavailable: false };
    provider.set(item.merchantRef, item);
    if (loseNextCreation) { loseNextCreation = false; throw new Error('simulated response loss after acceptance'); }
    return Response.json({ Response: { OriginatorConversationID: item.merchantRef, ConversationID: item.conversationId, ResponseCode: 0, ServiceStatus: 0 } });
  }
  assert.ok(url.endsWith('/queryTransactionStatus_sync'));
  const query = body.QueryTransactionStatus;
  const item = provider.get(query.QueryTransactionStatusRequest.OriginalConversationID);
  if (!item || item.queryUnavailable) return new Response('unavailable', { status: 503 });
  return Response.json({ QueryTransStatusRs: { ResultType: 0, ResultCode: 0,
    Transaction: { TransactionStatus: item.paid ? 'Completed' : 'Pending', ...(item.paid ? { ReceiptNumber: item.receipt } : {}) } } });
};
const gateway = new SandboxUnitelMoney(config, fakeFetch);
const handlers = createUnitelHandlers({ config, origins: config.allowedOrigins, store, gateway,
  actor: async request => request.headers.get('x-test-actor'), defer: task => { deferred.push(task); },
});
const req = (body, headers = {}) => new Request('https://sandbox.example.test/function', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://sandbox.example.test', ...headers }, body: JSON.stringify(body) });
async function call(body, user = 1, expected = 200) {
  const response = await handlers.user(req(body, { 'x-test-actor': id(user) }));
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify({ result, sqlErrors: sqlErrors.slice(-2) }));
  return result;
}
const drain = async () => { while (deferred.length) await Promise.all(deferred.splice(0)); };
const creates = () => network.filter(x => x.url.endsWith('/buyGoods_async')).length;
const queries = () => network.filter(x => x.url.endsWith('/queryTransactionStatus_sync')).length;
const original = attempt => inDatabase(async () => (await db.query('select * from massa_unitel.attempts where id=$1', [attempt.id])).rows[0]);
const journalCount = orderId => inDatabase(async () => (await db.query("select count(*)::int n from payment_point_private.journals where operation='payment' and reference=$1", [orderId])).rows[0].n);
const callback = item => ({ ResultBuyGoods: { OriginatorConversationID: item.merchantRef, ConversationID: item.conversationId,
  ResultType: 0, ResultCode: 0, TransactionResult: { TransactionID: item.receipt } } });
const createBody = (request, orderId) => ({ action: 'create', requestId: id(request), orderId, phone: '923000001' });

await test('creation uses server order amount; acceptance creates no ledger credit and replay never recharges', async () => {
  const orderId = await order(1001, 12345), before = creates();
  const created = await call(createBody(2001, orderId));
  assert.equal(created.attempt.state, 'pending'); assert.equal(created.reused, false);
  assert.equal(created.attempt.method, 'UNITEL_MONEY'); assert.equal(created.attempt.purpose, 'order');
  assert.equal(Object.hasOwn(created.attempt, 'phone'), false); assert.equal(Object.hasOwn(created.attempt, 'merchant'), false);
  assert.deepEqual(network.find(x => x.url.endsWith('/buyGoods_async')).body.BuyGoodRec.TransactionRequest.Parameters, { Amount: '123.45', Currency: 'AOA' });
  assert.equal(await journalCount(orderId), 0);
  const repeated = await call(createBody(2001, orderId));
  assert.equal(repeated.attempt.id, created.attempt.id); assert.equal(repeated.reused, true); assert.equal(creates() - before, 1);
  await call({ ...createBody(2002, orderId), amountMinor: 1 }, 1, 400);
  assert.equal(creates() - before, 1);
});

await test('authenticated completion credits once across repeated status and callbacks', async () => {
  const orderId = id(1001), before = (await wallet(2, 'overview')).wallet.earned;
  const saved = await call({ action: 'status', orderId });
  const attempt = await original(saved.attempt), item = provider.get(attempt.merchant_ref); item.paid = true;
  const paid = await call({ action: 'status', requestId: id(2001) });
  assert.equal(paid.attempt.state, 'confirmed');
  assert.equal((await wallet(2, 'overview')).wallet.earned, before + 12345);
  assert.equal((await wallet(1, 'view', orderId)).payment_provider, 'unitel');
  await call({ action: 'status', attemptId: paid.attempt.id });
  const ack = await handlers.webhook(req(callback(item))); assert.equal(ack.status, 200);
  const acknowledgement = await ack.json();
  assert.equal(acknowledgement.OriginatorConversationID, item.merchantRef);
  assert.equal(acknowledgement.message, 'Callback recebido com sucesso');
  await drain(); await handlers.webhook(req(callback(item))); await drain();
  assert.equal(await journalCount(orderId), 1);
  assert.equal((await wallet(2, 'overview')).wallet.earned, before + 12345);
  await assert.rejects(wallet(2, 'refund', orderId), /reembolso externo/);
});

await test('lost initial response is recovered by original reference with no callback and no second financial POST', async () => {
  const orderId = await order(1002, 501), before = creates(); loseNextCreation = true;
  const created = await call(createBody(2003, orderId));
  assert.equal(created.attempt.state, 'uncertain'); assert.equal(created.attempt.provider_conversation_id, null);
  const attempt = await original(created.attempt); provider.get(attempt.merchant_ref).paid = true;
  const reused = await call(createBody(2003, orderId)); assert.equal(reused.reused, true);
  const paid = await call({ action: 'status', requestId: id(2003) });
  assert.equal(paid.attempt.state, 'confirmed'); assert.equal(creates() - before, 1); assert.equal(await journalCount(orderId), 1);
  const query = network.at(-1).body.QueryTransactionStatus;
  assert.equal(query.QueryTransactionStatusRequest.OriginalConversationID, attempt.merchant_ref);
  assert.notEqual(query.OriginatorConversationID, attempt.merchant_ref);
});

await test('seller can check a pending order without access to the payer telephone', async () => {
  const orderId = await order(1003); const created = await call(createBody(2004, orderId));
  const redacted = await store.rpc('massa_unitel_get', { p_actor: id(2), p_attempt_id: created.attempt.id });
  assert.equal(redacted.phone, null);
  const checked = await call({ action: 'status', orderId }, 2);
  assert.equal(checked.attempt.state, 'pending'); assert.equal(Object.hasOwn(checked.attempt, 'phone'), false);
  await call({ action: 'status', attemptId: created.attempt.id }, 3, 403);
});

await test('forged successful notification is only a hint; duplicate cannot amplify queries', async () => {
  const pending = await call({ action: 'status', orderId: id(1003) });
  const attempt = await original(pending.attempt), item = provider.get(attempt.merchant_ref), before = queries();
  const body = callback(item);
  body.ResultBuyGoods.TransactionResult.Amount = '999999';
  const first = await handlers.webhook(req(body)); assert.equal(first.status, 200); await drain();
  assert.equal(queries() - before, 1);
  await handlers.webhook(req(body)); await drain(); assert.equal(queries() - before, 1);
  assert.equal((await original(pending.attempt)).state, 'pending'); assert.equal(await journalCount(id(1003)), 0);
});

await test('durable callback inbox recovers provider outage through the token-protected leased worker', async () => {
  const orderId = await order(1004); const created = await call(createBody(2005, orderId));
  const attempt = await original(created.attempt), item = provider.get(attempt.merchant_ref); item.queryUnavailable = true;
  assert.equal((await handlers.webhook(req(callback(item)))).status, 200); await drain();
  assert.equal((await original(created.attempt)).state, 'pending'); assert.equal(await journalCount(orderId), 0);
  const queued = await inDatabase(async () => (await db.query('select * from massa_unitel.events where attempt_id=$1', [attempt.id])).rows[0]);
  assert.equal(queued.processed_at, null); assert.equal(queued.issue_code, 'query_unavailable');
  item.queryUnavailable = false; item.paid = true;
  await inDatabase(async () => {
    await db.query("update massa_unitel.events set next_check_at=now()-interval '1 minute',lease_until=null where id=$1", [queued.id]);
    await db.exec("update massa_unitel.attempts set next_check_at=now()+interval '1 day'");
  });
  assert.equal((await handlers.reconcile(req({}))).status, 401);
  const checked = await handlers.reconcile(req({}, { 'x-massa-reconcile-token': config.reconcileToken }));
  assert.equal(checked.status, 200); assert.equal((await checked.json()).eventsExamined, 1);
  assert.equal((await original(created.attempt)).state, 'confirmed'); assert.equal(await journalCount(orderId), 1);
});

await test('late paid query on expired order preserves evidence and blocks a new charge without crediting', async () => {
  const orderId = await order(1005); const created = await call(createBody(2006, orderId));
  const attempt = await original(created.attempt); provider.get(attempt.merchant_ref).paid = true;
  await inDatabase(() => db.query("update payment_point_orders set expires_at=now()-interval '1 minute' where id=$1", [orderId]));
  const reviewed = await call({ action: 'status', attemptId: attempt.id });
  assert.equal(reviewed.attempt.state, 'review'); assert.equal((await original(created.attempt)).observed_paid, true);
  assert.equal(await journalCount(orderId), 0);
  const before = creates(); await call(createBody(2007, orderId), 1, 409); assert.equal(creates(), before);
  await call({ action: 'status', attemptId: attempt.id }); assert.equal(await journalCount(orderId), 0);
});

await test('UNITEL and AppyPay cannot initiate simultaneous charges for one order in either direction', async () => {
  const unitelOrder = await order(1006); await call(createBody(2008, unitelOrder));
  await assert.rejects(store.rpc('massa_gateway_prepare', { p_actor: id(1), p_request_id: id(3001), p_method: 'REF', p_phone: null,
    p_merchant: 'APPY_INTEGRATION_TEST', p_order_id: unitelOrder, p_amount_minor: null }), /request_rejected/);
  const appyOrder = await order(1007);
  await store.rpc('massa_gateway_prepare', { p_actor: id(1), p_request_id: id(3002), p_method: 'REF', p_phone: null,
    p_merchant: 'APPY_INTEGRATION_TEST', p_order_id: appyOrder, p_amount_minor: null });
  const before = creates(); await call(createBody(2009, appyOrder), 1, 409); assert.equal(creates(), before);
  assert.equal(await journalCount(unitelOrder), 0); assert.equal(await journalCount(appyOrder), 0);
});

await db.close();
