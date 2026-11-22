import test from 'node:test';
import assert from 'node:assert/strict';
import { createGatewayHandlers } from '../../supabase/functions/massa-appypay/handler.ts';
import { GatewayError, SANDBOX_RESOURCE, normalizeCharge } from '../../supabase/functions/_shared/massa-appypay.ts';

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = id(1);
const cfg = () => ({
  clientId: id(10), clientSecret: 'fake-server-secret', resource: SANDBOX_RESOURCE,
  merchant: 'MASSA_TEST_MERCHANT', gpoKey: `GPO_${id(11)}`, refKey: `REF_${id(12)}`,
  allowedUsers: new Set([actor]), allowedOrigins: new Set(['https://sandbox.example.test']),
  webhookMode: 'verify-by-query', webhookToken: '', reconcileToken: 'fake-cron-token-at-least-32-characters',
});
const baseAttempt = overrides => ({
  id: id(100), request_id: id(101), order_id: null, purpose: 'topup',
  actor_id: actor, beneficiary_id: actor, amount_minor: 10000, currency: 'AOA',
  method: 'GPO', phone: '900000000', merchant: cfg().merchant, merchant_ref: 'M20261122000101',
  provider_charge_id: null, state: 'uncertain', provider_code: null, reference: null, entity: null,
  provider_due_at: null, issue_code: null, observed_paid: false,
  created_at: '2026-11-22T12:00:00Z', updated_at: '2026-11-22T12:00:00Z', ...overrides,
});
const providerBody = (code = 100, overrides = {}) => ({
  id: id(200), merchantTransactionId: baseAttempt().merchant_ref, amount: 100, currency: 'AOA',
  responseStatus: { code, successful: true, status: 'Success', source: 'GPO' }, ...overrides,
});
const request = (body, headers = {}, options = {}) => new Request('https://sandbox.example.test/function', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-user-session', ...headers },
  body: JSON.stringify(body), ...options,
});

/** Deliberately tiny persistence double; SQL accounting/permissions have independent database tests. */
function setup(options = {}) {
  let current = baseAttempt(options.attempt);
  let prepared = false, eventCounter = 0;
  const calls = [], fetches = [], deferred = [], events = new Map();
  const config = options.disabled ? null : { ...cfg(), ...options.config };
  const store = { async rpc(name, args) {
    calls.push({ name, args });
    if (options.rpc) {
      const custom = await options.rpc(name, args);
      if (custom !== undefined) return custom;
    }
    if (name === 'massa_gateway_prepare') {
      const result = { ...current, submit: !prepared && !options.reuse };
      prepared = true;
      return result;
    }
    if (name === 'massa_gateway_get' || name === 'massa_gateway_find') {
      if (name === 'massa_gateway_find' && !args.p_attempt_id && args.p_merchant_ref !== current.merchant_ref && args.p_charge_id !== current.provider_charge_id) return null;
      return { ...current };
    }
    if (name === 'massa_gateway_record') {
      if (current.state !== 'confirmed') current = { ...current, state: args.p_state,
        provider_charge_id: current.provider_charge_id ?? args.p_charge_id,
        provider_code: args.p_code, issue_code: args.p_issue,
        observed_paid: current.observed_paid || args.p_observed_paid,
        reference: args.p_reference ?? current.reference, entity: args.p_entity ?? current.entity,
      };
      return { ...current };
    }
    if (name === 'massa_gateway_confirm') {
      current = { ...current, provider_charge_id: args.p_charge_id, state: 'confirmed', observed_paid: true, issue_code: null };
      return { ...current };
    }
    if (name === 'massa_gateway_event') {
      const previous = events.get(args.p_event_hash);
      if (previous) return { ...previous, duplicate: true };
      const event = { event_id: id(300 + eventCounter++), duplicate: false,
        attempt_id: args.p_merchant_ref === current.merchant_ref || args.p_charge_id === current.provider_charge_id ? current.id : null,
        charge_id: args.p_charge_id, merchant_ref: args.p_merchant_ref, merchant: args.p_merchant,
        processed_at: null, issue_code: null,
      };
      events.set(args.p_event_hash, event);
      return { ...event };
    }
    if (name === 'massa_gateway_event_done') {
      for (const event of events.values()) if (event.event_id === args.p_event_id) {
        event.issue_code = args.p_issue;
        if (!args.p_issue) event.processed_at = '2026-11-22T12:00:05Z';
      }
      return null;
    }
    if (name === 'massa_gateway_due') return current.state === 'confirmed' ? [] : [{ ...current }];
    if (name === 'massa_gateway_events_due') return [...events.values()].filter(event => !event.processed_at).map(event => ({ ...event }));
    throw new Error(`Unexpected RPC ${name}`);
  } };
  const gateway = {
    async create(a) {
      fetches.push({ method: 'POST', attempt: a.id });
      if (options.create) return await options.create(a);
      return normalizeCharge(providerBody(101));
    },
    async get(chargeId) {
      fetches.push({ method: 'GET', chargeId });
      if (options.get) return await options.get(chargeId);
      return normalizeCharge(providerBody());
    },
  };
  const handlers = createGatewayHandlers({ config, origins: cfg().allowedOrigins, store, gateway,
    actor: async () => options.user === undefined ? actor : options.user,
    defer: promise => { deferred.push(promise); },
  });
  return { handlers, calls, fetches, events, current: () => current,
    drain: async () => { await Promise.all(deferred); },
  };
}
const createBody = overrides => ({ action: 'create', requestId: id(101), method: 'GPO', phone: '900000000', amountMinor: 10000, ...overrides });

test('disabled capability stays hidden; unauthenticated/unlisted actors cannot create a charge', async () => {
  const disabled = setup({ disabled: true });
  assert.deepEqual(await (await disabled.handlers.user(request({ action: 'capabilities' }))).json(), {
    enabled: false, environment: 'sandbox', methods: [],
  });
  assert.equal((await disabled.handlers.user(request(createBody()))).status, 503);
  for (const [user, status] of [[null, 401], [id(2), 403]]) {
    const h = setup({ user });
    assert.equal((await h.handlers.user(request(createBody()))).status, status);
    assert.equal(h.calls.length, 0);
    assert.equal(h.fetches.length, 0);
  }
});

test('HTTP boundary rejects unexpected origins, methods and large or malformed request bodies', async () => {
  const h = setup();
  assert.equal((await h.handlers.user(request(createBody(), { Origin: 'https://evil.test' }))).status, 403);
  assert.equal((await h.handlers.user(new Request('https://sandbox.example.test/function'))).status, 405);
  assert.equal((await h.handlers.user(request(createBody(), { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await h.handlers.user(request({ huge: 'x'.repeat(9000) }))).status, 400);
  assert.equal((await h.handlers.user(new Request('https://sandbox.example.test/function', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'bad JSON' }))).status, 400);
  assert.equal(h.calls.length, 0);
  assert.equal(h.fetches.length, 0);
});

test('HTTP creation cannot settle directly from a code-100 POST response', async () => {
  const h = setup({ create: async () => normalizeCharge(providerBody(100)), get: async () => normalizeCharge(providerBody(101)) });
  const result = await h.handlers.user(request(createBody(), { Origin: 'https://sandbox.example.test' }));
  const body = await result.json();
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://sandbox.example.test');
  assert.equal(body.attempt.state, 'pending');
  assert.deepEqual(h.fetches.map(call => call.method), ['POST', 'GET']);
  assert.equal(h.calls.some(call => call.name === 'massa_gateway_confirm'), false);
});

test('replayed create returns the saved attempt without a second provider POST', async () => {
  const h = setup({ get: async () => normalizeCharge(providerBody(101)) });
  const first = await (await h.handlers.user(request(createBody()))).json();
  const second = await (await h.handlers.user(request(createBody()))).json();
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.equal(h.fetches.filter(call => call.method === 'POST').length, 1);
});

test('lost POST response stays uncertain and a replay never resubmits the financial instruction', async () => {
  const h = setup({ create: async () => { throw new GatewayError('creation_uncertain', true); } });
  const first = await (await h.handlers.user(request(createBody()))).json();
  assert.equal(first.attempt.state, 'uncertain');
  assert.equal(first.attempt.issue_code, 'creation_uncertain');
  await h.handlers.user(request(createBody()));
  assert.equal(h.fetches.filter(call => call.method === 'POST').length, 1);
  assert.equal(h.calls.some(call => call.name === 'massa_gateway_confirm'), false);
});

test('an unsigned webhook claiming Success cannot credit when trusted GET is pending', async () => {
  const h = setup({ get: async () => normalizeCharge(providerBody(101)) });
  const ack = await h.handlers.webhook(request(providerBody(100)));
  assert.equal(ack.status, 200);
  assert.equal(h.events.size, 1);
  await h.drain();
  assert.equal(h.fetches.filter(call => call.method === 'GET').length, 1);
  assert.equal(h.calls.some(call => call.name === 'massa_gateway_confirm'), false);
  assert.equal(h.current().state, 'pending');
});

test('webhook supplied amount and currency never replace stored or queried financial evidence', async () => {
  const h = setup({ get: async () => normalizeCharge(providerBody(100)) });
  await h.handlers.webhook(request(providerBody(100, { amount: 999999, currency: 'USD' })));
  await h.drain();
  const confirms = h.calls.filter(call => call.name === 'massa_gateway_confirm');
  assert.equal(confirms.length, 1);
  assert.equal(confirms[0].args.p_amount_minor, 10000);
  assert.equal(confirms[0].args.p_currency, 'AOA');
  const event = h.calls.find(call => call.name === 'massa_gateway_event');
  assert.equal(Object.hasOwn(event.args, 'amount'), false);
  assert.equal(Object.hasOwn(event.args, 'raw'), false);
});

test('an unrelated charge ID in an unsigned callback cannot freeze the intended attempt', async () => {
  const h = setup({ get: async () => normalizeCharge(providerBody(100, { id: id(999), merchantTransactionId: 'UNRELATEDORDER' })) });
  await h.handlers.webhook(request(providerBody(100, { id: id(999) })));
  await h.drain();
  assert.equal(h.calls.some(call => call.name === 'massa_gateway_confirm'), false);
  assert.equal(h.current().state, 'uncertain');
  assert.equal(h.current().observed_paid, false);
  assert.equal(h.current().provider_charge_id, null);
});

test('callback GET outage can recover from a duplicate callback without a new charge', async () => {
  let gets = 0;
  const h = setup({ get: async () => {
    if (++gets === 1) throw new GatewayError('query_unavailable');
    return normalizeCharge(providerBody(100));
  } });
  const body = providerBody(100);
  await h.handlers.webhook(request(body));
  await h.drain();
  assert.equal(h.current().provider_charge_id, null);
  assert.equal(h.current().state, 'uncertain');
  await h.handlers.webhook(request(body));
  await h.drain();
  assert.equal(gets, 2);
  assert.equal(h.current().state, 'confirmed');
  assert.equal(h.fetches.some(call => call.method === 'POST'), false);
});

test('completed duplicate callbacks are acknowledged without applying another credit', async () => {
  const h = setup();
  await h.handlers.webhook(request(providerBody()));
  await h.drain();
  await h.handlers.webhook(request(providerBody()));
  await h.drain();
  assert.equal(h.events.size, 1);
  assert.equal(h.calls.filter(call => call.name === 'massa_gateway_confirm').length, 1);
});

test('durable inbox storage failure is not acknowledged as received', async () => {
  const h = setup({ rpc: async name => {
    if (name === 'massa_gateway_event') throw new GatewayError('storage_unavailable');
  } });
  assert.equal((await h.handlers.webhook(request(providerBody()))).status, 503);
  assert.equal(h.fetches.length, 0);
});

test('shared-token mode rejects unsigned callbacks before storage or provider access', async () => {
  const webhookToken = 'fake-webhook-token-at-least-32-characters';
  const h = setup({ config: { webhookMode: 'shared-token', webhookToken } });
  assert.equal((await h.handlers.webhook(request(providerBody()))).status, 401);
  assert.equal(h.calls.length, 0);
  assert.equal(h.fetches.length, 0);
  assert.equal((await h.handlers.webhook(request(providerBody(), { 'x-yamilook-token': webhookToken }))).status, 200);
  await h.drain();
  assert.equal(h.current().state, 'confirmed');
});

test('reconciliation requires a server token and cannot create new charges', async () => {
  const h = setup({ attempt: { provider_charge_id: id(200), state: 'pending' } });
  assert.equal((await h.handlers.reconcile(request({}))).status, 401);
  assert.equal(h.calls.length, 0);
  const result = await h.handlers.reconcile(request({}, { 'x-massa-reconcile-token': cfg().reconcileToken }));
  assert.equal(result.status, 200);
  assert.equal(h.current().state, 'confirmed');
  assert.equal(h.fetches.some(call => call.method === 'POST'), false);
});

test('operator recovery validates a portal charge with GET and never trusts supplied financial fields', async () => {
  const h = setup();
  const result = await h.handlers.reconcile(request({ attemptId: id(100), chargeId: id(200), amount: 99999 }, {
    'x-massa-reconcile-token': cfg().reconcileToken,
  }));
  assert.equal(result.status, 200);
  assert.equal(h.current().state, 'confirmed');
  assert.deepEqual(h.fetches, [{ method: 'GET', chargeId: id(200) }]);
  assert.equal(h.calls.find(call => call.name === 'massa_gateway_confirm').args.p_amount_minor, 10000);
});

test('generic provider/store exceptions are redacted at the HTTP boundary', async () => {
  const h = setup({ rpc: async () => { throw new Error('private key and full customer details'); } });
  const result = await h.handlers.user(request({ action: 'status', attemptId: id(100) }));
  const text = await result.text();
  assert.equal(result.status, 503);
  assert.equal(text.includes('private key'), false);
  assert.match(text, /service_unavailable/);
});
