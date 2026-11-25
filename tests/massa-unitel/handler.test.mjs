import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Load the actual TypeScript orchestration in Node 22+ without a network resolver.
async function moduleUrl(relative, replacements = {}) {
  const file = new URL(relative, import.meta.url);
  let source = stripTypeScriptTypes(await readFile(file, 'utf8'));
  for (const [path, target] of Object.entries(replacements)) source = source.replaceAll(`'${path}'`, `'${target}'`);
  return `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=${file.href}`).toString('base64')}`;
}
const adapterUrl = await moduleUrl('../../supabase/functions/_shared/massa-unitel.ts');
const serviceUrl = await moduleUrl('../../supabase/functions/_shared/massa-unitel-service.ts', { './massa-unitel.ts': adapterUrl });
const handlerUrl = await moduleUrl('../../supabase/functions/massa-unitel/handler.ts', {
  '../_shared/massa-unitel.ts': adapterUrl, '../_shared/massa-unitel-service.ts': serviceUrl,
});
const { UnitelError, normalizeQuery } = await import(adapterUrl);
const { createUnitelHandlers } = await import(handlerUrl);
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const config = () => ({
  clientId: 'unit-test-client', clientSecret: 'unit-test-secret', operator: 'unit-test-operator',
  securityCredential: 'unit-test-operator-secret', merchant: 'TEST_MERCHANT', posDeviceId: 'TEST_POS',
  tokenUrl: 'https://sandbox-unit-tests.unitel.co.ao/token', apiBaseUrl: 'https://sandbox-unit-tests.unitel.co.ao/api',
  callbackUrl: 'https://abcdefghijklmnopqrst.supabase.co/functions/v1/massa-unitel-webhook',
  allowedHosts: new Set(['sandbox-unit-tests.unitel.co.ao']), allowedUsers: new Set([uuid(1), uuid(2)]),
  allowedBeneficiaries: new Set([uuid(2)]), allowedPhones: new Set(['900000101']),
  allowedOrigins: new Set(['https://sandbox.example.test']), reconcileToken: 'unit-test-reconcile-token-at-least-32-characters',
  webhookToken: '',
});
const initialAttempt = () => ({
  id: uuid(10), request_id: uuid(11), order_id: uuid(12), actor_id: uuid(1), beneficiary_id: uuid(2),
  amount_minor: 12345, currency: 'AOA', phone: '900000101', merchant: 'TEST_MERCHANT', merchant_ref: 'MU_TEST_ORIGINAL',
  provider_conversation_id: 'AG_TEST_ORIGINAL', provider_transaction_id: null, state: 'pending',
  issue_code: null, provider_code: 0, observed_paid: false,
  created_at: '2026-11-25T10:00:00.000Z', updated_at: '2026-11-25T10:00:00.000Z',
});
const callback = (overrides = {}) => ({ ResultBuyGoods: {
  OriginatorConversationID: 'MU_TEST_ORIGINAL', ConversationID: 'AG_TEST_ORIGINAL', ResultCode: 0,
  TransactionResult: { TransactionID: 'UNTRUSTED_CALLBACK_RECEIPT' }, ...overrides,
} });
const req = (body, headers = {}, method = 'POST') => new Request('https://sandbox.example.test/function', {
  method, headers: { 'Content-Type': 'application/json', ...headers },
  ...(method === 'GET' || method === 'OPTIONS' ? {} : { body: JSON.stringify(body) }),
});
const actorHeaders = { Authorization: 'Bearer buyer' };

/** Store is deliberately a small RPC spy, not a substitute for the PostgreSQL tests. */
function harness(options = {}) {
  const settings = options.config === null ? null : { ...config(), ...options.config };
  let current = { ...initialAttempt(), ...options.attempt };
  let prepared = options.prepared ?? true;
  const rpcCalls = [], deferred = [], events = new Map();
  let creates = 0, queries = 0, confirmations = 0;
  let createOutcome = options.createOutcome;
  let queryOutcome = options.queryOutcome;
  const store = {
    async rpc(name, args) {
      rpcCalls.push({ name, args });
      if (options.storeError) throw options.storeError;
      if (name === 'massa_unitel_prepare') {
        assert.equal(args.p_order_id, current.order_id);
        assert.deepEqual(args.p_allowed_beneficiaries, [uuid(2)]);
        const submit = !prepared; prepared = true;
        return { ...current, submit };
      }
      if (name === 'massa_unitel_get') {
        if (![current.actor_id, current.beneficiary_id].includes(args.p_actor)) throw new UnitelError('access_denied');
        return { ...current, phone: args.p_actor === current.actor_id ? current.phone : null };
      }
      if (name === 'massa_unitel_record') {
        current = { ...current, state: args.p_state, issue_code: args.p_issue, provider_code: args.p_code,
          observed_paid: current.observed_paid || args.p_observed_paid,
          provider_conversation_id: args.p_conversation_id ?? current.provider_conversation_id };
        return { ...current };
      }
      if (name === 'massa_unitel_confirm') {
        confirmations++;
        assert.equal(args.p_merchant_ref, current.merchant_ref);
        current = { ...current, state: 'confirmed', provider_transaction_id: args.p_transaction_id,
          observed_paid: true, issue_code: null };
        return { ...current };
      }
      if (name === 'massa_unitel_event') {
        if (args.p_merchant_ref !== current.merchant_ref) return { event_id: null, attempt_id: null, duplicate: false };
        const existing = events.get(args.p_event_hash);
        if (existing) return { ...existing, duplicate: true };
        const event = { event_id: uuid(100 + events.size), attempt_id: current.id, processed_at: null, duplicate: false,
          merchant_ref: args.p_merchant_ref, conversation_id: args.p_conversation_id, transaction_id: args.p_transaction_id };
        events.set(args.p_event_hash, event);
        return { ...event };
      }
      if (name === 'massa_unitel_find') return { ...current };
      if (name === 'massa_unitel_event_done') {
        for (const event of events.values()) if (event.event_id === args.p_event_id) {
          if (!args.p_issue || ['event_mismatch', 'attempt_not_found'].includes(args.p_issue)) event.processed_at = '2026-11-25T10:01:00Z';
          event.issue_code = args.p_issue;
        }
        return null;
      }
      if (name === 'massa_unitel_events_due') return [...events.values()].filter(event => !event.processed_at);
      if (name === 'massa_unitel_due') return ['pending', 'submitting', 'uncertain'].includes(current.state) ? [{ ...current }] : [];
      throw new Error(`Unexpected RPC ${name}`);
    },
  };
  const gateway = {
    async create(value) {
      creates++;
      if (createOutcome instanceof Error) throw createOutcome;
      return createOutcome ?? { merchantRef: value.merchant_ref, conversationId: 'AG_TEST_ORIGINAL', state: 'pending', code: 0 };
    },
    async query(value) {
      queries++;
      assert.equal(value.merchant_ref, 'MU_TEST_ORIGINAL');
      if (queryOutcome instanceof Error) throw queryOutcome;
      return queryOutcome ?? { merchantRef: value.merchant_ref, conversationId: value.provider_conversation_id,
        transactionId: null, state: 'pending', code: 0, observedPaid: false };
    },
  };
  const handlers = createUnitelHandlers({ config: settings, origins: config().allowedOrigins, store, gateway,
    actor: async request => ({ 'Bearer buyer': uuid(1), 'Bearer seller': uuid(2), 'Bearer outsider': uuid(3) })[request.headers.get('Authorization')] ?? null,
    defer: task => deferred.push(task),
  });
  return { handlers, rpcCalls, events, settings,
    drain: async () => { await Promise.all(deferred); },
    state: () => ({ ...current }), counts: () => ({ creates, queries, confirmations }),
    setQuery: value => { queryOutcome = value; }, setCreate: value => { createOutcome = value; },
  };
}

test('user methods require authentication, pilot membership and an allowed browser origin', async () => {
  const h = harness();
  assert.equal((await h.handlers.user(req({ action: 'create' }))).status, 401);
  assert.equal((await h.handlers.user(req({ action: 'status' }, { Authorization: 'Bearer outsider' }))).status, 403);
  assert.equal((await h.handlers.user(req({ action: 'capabilities' }, { ...actorHeaders, Origin: 'https://evil.test' }))).status, 403);
  assert.equal(h.rpcCalls.length, 0); assert.deepEqual(h.counts(), { creates: 0, queries: 0, confirmations: 0 });
});

test('capabilities expose only sandbox methods and operator-approved phones to the pilot', async () => {
  const h = harness();
  const response = await h.handlers.user(req({ action: 'capabilities' }, actorHeaders));
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { enabled: true, environment: 'sandbox', methods: ['UNITEL_MONEY'], testPhones: ['900000101'] });
  const outsider = await h.handlers.user(req({ action: 'capabilities' }, { Authorization: 'Bearer outsider' }));
  assert.deepEqual(await outsider.json(), { enabled: false, environment: 'sandbox', methods: [] });
  const disabled = harness({ config: null });
  assert.deepEqual(await (await disabled.handlers.user(req({ action: 'capabilities' }))).json(), { enabled: false, environment: 'sandbox', methods: [] });
  assert.equal((await disabled.handlers.webhook(req(callback()))).status, 503);
  assert.equal((await disabled.handlers.user(req({ action: 'create' }, actorHeaders))).status, 503);
  assert.equal(h.rpcCalls.length, 0);
});

test('methods, request content and size are bounded before orchestration', async () => {
  const h = harness();
  assert.equal((await h.handlers.user(req({}, actorHeaders, 'GET'))).status, 405);
  assert.equal((await h.handlers.webhook(req({}, {}, 'OPTIONS'))).status, 405);
  assert.equal((await h.handlers.user(req({}, { ...actorHeaders, 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await h.handlers.user(req({ huge: 'x'.repeat(9000) }, actorHeaders))).status, 400);
  assert.equal((await h.handlers.webhook(req({ huge: 'x'.repeat(70_000) }))).status, 400);
  assert.equal((await h.handlers.webhook(req({ Result: {} }))).status, 400);
  assert.equal(h.rpcCalls.length, 0);
});

test('service forbids top-ups, client-selected amounts/beneficiaries and unlisted test phones', async () => {
  const h = harness({ prepared: false });
  const valid = { action: 'create', requestId: uuid(11), orderId: uuid(12), phone: '900000101' };
  for (const input of [{ ...valid, orderId: null }, { ...valid, amountMinor: 1 }, { ...valid, amount: 1 },
    { ...valid, beneficiaryId: uuid(3) }, { ...valid, purpose: 'topup' }, { ...valid, currency: 'USD' },
    { ...valid, phone: '923123456' }]) {
    assert.equal((await h.handlers.user(req(input, actorHeaders))).status, 400);
  }
  assert.equal(h.rpcCalls.length, 0); assert.equal(h.counts().creates, 0);
});

test('accepted creation remains pending and public response contains no credentials or telephone', async () => {
  const h = harness({ prepared: false });
  const response = await h.handlers.user(req({ action: 'create', requestId: uuid(11), orderId: uuid(12), phone: '900000101' }, actorHeaders));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.attempt.state, 'pending'); assert.equal(result.attempt.amount_minor, 12345);
  assert.equal(result.attempt.method, 'UNITEL_MONEY'); assert.equal(result.attempt.purpose, 'order');
  for (const key of ['phone', 'merchant', 'merchant_ref', 'actor_id', 'beneficiary_id', 'clientSecret', 'securityCredential']) {
    assert.equal(Object.hasOwn(result.attempt, key), false, key);
  }
  assert.deepEqual(h.counts(), { creates: 1, queries: 0, confirmations: 0 });
});

test('a lost financial POST is not repeated; status recovers using the original persisted reference', async () => {
  const h = harness({ prepared: false, createOutcome: new UnitelError('creation_uncertain', true),
    attempt: { provider_conversation_id: null } });
  const create = { action: 'create', requestId: uuid(11), orderId: uuid(12), phone: '900000101' };
  const first = await (await h.handlers.user(req(create, actorHeaders))).json();
  assert.equal(first.attempt.state, 'uncertain');
  const repeated = await (await h.handlers.user(req(create, actorHeaders))).json();
  assert.equal(repeated.reused, true); assert.equal(h.counts().creates, 1);
  h.setQuery({ merchantRef: 'MU_TEST_ORIGINAL', conversationId: null, transactionId: 'VERIFIED_QUERY_RECEIPT', state: 'confirmed', code: 0, observedPaid: true });
  const status = await (await h.handlers.user(req({ action: 'status', attemptId: uuid(10) }, actorHeaders))).json();
  assert.equal(status.attempt.state, 'confirmed');
  assert.deepEqual(h.counts(), { creates: 1, queries: 1, confirmations: 1 });
  assert.equal(h.rpcCalls.find(call => call.name === 'massa_unitel_confirm').args.p_transaction_id, 'VERIFIED_QUERY_RECEIPT');
});

test('callback success is acknowledged but cannot settle a payment while the authenticated query is pending', async () => {
  const h = harness();
  const response = await h.handlers.webhook(req(callback()));
  assert.equal(response.status, 200);
  const ack = await response.json();
  assert.equal(ack.status, 'success'); assert.equal(ack.OriginatorConversationID, 'MU_TEST_ORIGINAL');
  assert.equal(ack.ConversationID, 'AG_TEST_ORIGINAL'); assert.ok(ack.timestamp);
  await h.drain();
  assert.equal(h.counts().queries, 1); assert.equal(h.counts().confirmations, 0);
  assert.equal(h.state().state, 'pending'); assert.equal(h.state().provider_transaction_id, null);
});

test('unknown callbacks do not create attempts or query the provider', async () => {
  const h = harness();
  const response = await h.handlers.webhook(req(callback({ OriginatorConversationID: 'UNKNOWN_ORIGINAL' })));
  assert.equal(response.status, 200); await h.drain();
  assert.deepEqual(h.counts(), { creates: 0, queries: 0, confirmations: 0 });
  assert.deepEqual(h.rpcCalls.map(call => call.name), ['massa_unitel_event']);
});

test('shared webhook token and reconciliation token are checked before storage access', async () => {
  const h = harness({ config: { webhookToken: 'unit-test-webhook-secret-at-least-32-characters' } });
  assert.equal((await h.handlers.webhook(req(callback()))).status, 401);
  assert.equal((await h.handlers.webhook(req(callback(), { 'x-massa-unitel-token': 'wrong' }))).status, 401);
  assert.equal((await h.handlers.reconcile(req({}))).status, 401);
  assert.equal((await h.handlers.reconcile(req({}, { 'x-massa-reconcile-token': 'wrong' }))).status, 401);
  assert.equal(h.rpcCalls.length, 0);
  assert.equal((await h.handlers.webhook(req(callback(), { 'x-massa-unitel-token': h.settings.webhookToken }))).status, 200);
  await h.drain();
});

test('duplicate pending callbacks do not bypass query limits; the inbox worker recovers a failed query', async () => {
  const h = harness({ queryOutcome: new UnitelError('query_unavailable') });
  assert.equal((await h.handlers.webhook(req(callback()))).status, 200); await h.drain();
  assert.equal(h.events.size, 1); assert.equal(h.counts().queries, 1);
  assert.equal([...h.events.values()][0].processed_at, null);
  for (let i = 0; i < 3; i++) assert.equal((await h.handlers.webhook(req(callback()))).status, 200);
  await h.drain(); assert.equal(h.counts().queries, 1); assert.equal(h.counts().confirmations, 0);
  h.setQuery({ merchantRef: 'MU_TEST_ORIGINAL', conversationId: 'AG_TEST_ORIGINAL', transactionId: 'VERIFIED_QUERY_RECEIPT', state: 'confirmed', code: 0, observedPaid: true });
  const response = await h.handlers.reconcile(req({}, { 'x-massa-reconcile-token': h.settings.reconcileToken }));
  assert.equal(response.status, 200);
  assert.equal(h.counts().queries, 2); assert.equal(h.counts().confirmations, 1);
  assert.equal(h.state().provider_transaction_id, 'VERIFIED_QUERY_RECEIPT');
  assert.equal(h.rpcCalls.some(call => call.name === 'massa_unitel_confirm' && call.args.p_transaction_id === 'UNTRUSTED_CALLBACK_RECEIPT'), false);
});

test('an authenticated completed response with a foreign echo stays audit evidence without reserving its receipt', async () => {
  const query = normalizeQuery({ QueryTransStatusRs: {
    ResultType: 0, ResultCode: 0, OriginalConversationID: 'A_DIFFERENT_PAYMENT',
    Transaction: { TransactionStatus: 'Completed', ReceiptNumber: 'CONFLICTING_QUERY_RECEIPT' },
  } }, initialAttempt(), 'MUQ_TEST_QUERY');
  assert.equal(query.state, 'review'); assert.equal(query.merchantRef, initialAttempt().merchant_ref);
  const h = harness({ queryOutcome: query });
  const response = await h.handlers.user(req({ action: 'status', attemptId: uuid(10) }, actorHeaders));
  assert.equal(response.status, 200); assert.equal(h.counts().confirmations, 0);
  const record = h.rpcCalls.find(call => call.name === 'massa_unitel_record');
  assert.equal(record.args.p_state, 'review'); assert.equal(record.args.p_observed_paid, true);
  assert.equal(record.args.p_transaction_id, 'CONFLICTING_QUERY_RECEIPT');
  assert.equal(record.args.p_bind_identity, false);
});

test('status checks reject multiple selectors and backend errors are redacted', async () => {
  const h = harness();
  assert.equal((await h.handlers.user(req({ action: 'status', attemptId: uuid(10), orderId: uuid(12) }, actorHeaders))).status, 400);
  assert.equal(h.rpcCalls.length, 0);
  const broken = harness({ storeError: new Error('private-secret-do-not-return') });
  const response = await broken.handlers.user(req({ action: 'status', attemptId: uuid(10) }, actorHeaders));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes('private-secret-do-not-return'), false);
});
