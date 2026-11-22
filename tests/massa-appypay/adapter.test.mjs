import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SANDBOX_GATEWAY, SANDBOX_TOKEN, SANDBOX_RESOURCE, MAX_MINOR, GatewayError, SandboxAppyPay,
  loadSandboxConfig, minorFromAmount, amountFromMinor, normalizeCharge, verifyCharge,
  isUuid, isMerchantRef, readJsonBody, publicAttempt, equalSecret,
} from '../../supabase/functions/_shared/massa-appypay.ts';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sandboxRef = 'abcdefghijklmnopqrst';
const envValues = (overrides = {}) => ({
  MASSA_APPYPAY_ENABLED: 'sandbox',
  MASSA_APPYPAY_SANDBOX_PROJECT_REF: sandboxRef,
  SUPABASE_URL: `https://${sandboxRef}.supabase.co`,
  MASSA_APPYPAY_CLIENT_ID: uuid(1),
  MASSA_APPYPAY_CLIENT_SECRET: 'fake-server-secret-never-for-a-provider',
  MASSA_APPYPAY_RESOURCE: SANDBOX_RESOURCE,
  MASSA_APPYPAY_MERCHANT_ID: 'MASSA_TEST_MERCHANT',
  MASSA_APPYPAY_GPO_KEY: `GPO_${uuid(2)}`,
  MASSA_APPYPAY_REF_KEY: `REF_${uuid(3)}`,
  MASSA_APPYPAY_ALLOWED_USERS: `${uuid(4)},${uuid(5)}`,
  MASSA_APPYPAY_RECONCILE_TOKEN: 'fake-reconciliation-secret-at-least-32-characters',
  MASSA_APPYPAY_ALLOWED_ORIGINS: 'https://sandbox.example.test',
  ...overrides,
});
const config = (overrides = {}) => {
  const values = envValues(overrides);
  return loadSandboxConfig(key => values[key]);
};
const attempt = (overrides = {}) => ({
  id: uuid(10), request_id: uuid(11), order_id: null, purpose: 'topup',
  actor_id: uuid(4), beneficiary_id: uuid(4), amount_minor: 12345, currency: 'AOA',
  method: 'GPO', phone: '900000000', merchant: 'MASSA_TEST_MERCHANT', merchant_ref: 'M20261122000001',
  provider_charge_id: null, state: 'submitting', provider_code: null,
  reference: null, entity: null, provider_due_at: null, issue_code: null,
  created_at: '2026-11-22T12:00:00.000Z', updated_at: '2026-11-22T12:00:00.000Z',
  ...overrides,
});
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const tokenResponse = (overrides = {}) => response({
  access_token: 'fake-token-for-tests-only', token_type: 'Bearer', expires_in: '3599', ...overrides,
});
const chargePayload = (overrides = {}) => ({
  id: uuid(20), merchantTransactionId: attempt().merchant_ref,
  amount: 123.45, currency: 'AOA',
  responseStatus: { successful: true, status: 'Success', code: 100, source: 'GPO' },
  ...overrides,
});
const hasCode = (code, uncertain = undefined) => error => {
  assert.ok(error instanceof GatewayError);
  assert.equal(error.code, code);
  if (uncertain !== undefined) assert.equal(error.uncertain, uncertain);
  return true;
};

test('configuration requires explicit opt-in, isolated project and complete server credentials', () => {
  assert.ok(config());
  for (const overrides of [
    { MASSA_APPYPAY_ENABLED: undefined }, { MASSA_APPYPAY_ENABLED: 'true' },
    { MASSA_APPYPAY_ENABLED: 'production' },
    { MASSA_APPYPAY_SANDBOX_PROJECT_REF: 'rfayqekonkovfbkwjjum', SUPABASE_URL: 'https://rfayqekonkovfbkwjjum.supabase.co' },
    { SUPABASE_URL: 'https://unrelated.supabase.co' }, { SUPABASE_URL: 'http://abcdefghijklmnopqrst.supabase.co' },
    { MASSA_APPYPAY_CLIENT_SECRET: '' }, { MASSA_APPYPAY_CLIENT_ID: 'invalid' },
    { MASSA_APPYPAY_GPO_KEY: `REF_${uuid(2)}` }, { MASSA_APPYPAY_REF_KEY: 'REF_invalid' },
    { MASSA_APPYPAY_ALLOWED_USERS: '' }, { MASSA_APPYPAY_ALLOWED_USERS: `${uuid(4)},*` },
    { MASSA_APPYPAY_RECONCILE_TOKEN: 'short' },
    { MASSA_APPYPAY_WEBHOOK_MODE: 'allow-all' },
    { MASSA_APPYPAY_WEBHOOK_MODE: 'shared-token', MASSA_APPYPAY_WEBHOOK_TOKEN: '' },
  ]) assert.equal(config(overrides), null, JSON.stringify(overrides));
  assert.ok(config({ MASSA_APPYPAY_WEBHOOK_MODE: 'shared-token', MASSA_APPYPAY_WEBHOOK_TOKEN: 'fake-callback-token-longer-than-32-characters' }));
});

test('sandbox configuration rejects ambiguous project URLs and production OAuth resource', () => {
  for (const url of [
    `https://login:password@${sandboxRef}.supabase.co`,
    `https://${sandboxRef}.supabase.co/other-project`,
    `https://${sandboxRef}.supabase.co?override=production`,
    `https://${sandboxRef}.supabase.co#fragment`,
  ]) assert.equal(config({ SUPABASE_URL: url }), null, url);
  assert.equal(config({ MASSA_APPYPAY_RESOURCE: 'bee57785-7a19-4f1c-9c8d-aa03f2f0e333' }), null);
});

test('legacy credentials are not silently reused and browser origins are exact HTTPS origins', () => {
  assert.equal(config({ MASSA_APPYPAY_CLIENT_SECRET: undefined, APPYPAY_API_SECRET: 'legacy-secret' }), null);
  const c = config({ MASSA_APPYPAY_ALLOWED_ORIGINS: 'https://sandbox.example.test,*,http://unsafe.test,https://unsafe.test/path' });
  assert.deepEqual([...c.allowedOrigins], ['https://sandbox.example.test']);
  assert.deepEqual([...c.allowedUsers], [uuid(4), uuid(5)]);
});

test('amount conversion preserves cents exactly and rejects rounding, overflow and nonmoney shapes', () => {
  for (const [value, cents] of [['0.01', 1], ['0.29', 29], [1.2, 120], ['123.45', 12345], ['1000000.00', MAX_MINOR]]) {
    assert.equal(minorFromAmount(value), cents);
    assert.equal(minorFromAmount(amountFromMinor(cents)), cents);
  }
  for (const value of ['1.005', 1.005, '1000000.01', Number.MAX_SAFE_INTEGER, Infinity, NaN, '-1', '0', '0.00',
    '1e3', '+1', ' 1 ', '1,25', null, undefined, true, [], {}, '123456789012345678901']) {
    assert.throws(() => minorFromAmount(value), hasCode('invalid_amount'), String(value));
  }
  for (const value of [0, -1, 1.5, NaN, Infinity, MAX_MINOR + 1, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => amountFromMinor(value), hasCode('invalid_amount'));
  }
});

test('UUIDs and merchant references exclude URL injection and unsupported characters', () => {
  assert.equal(isUuid(uuid(10)), true);
  for (const value of ['../charges', `${uuid(10)}?admin=1`, 'invalid', null]) assert.equal(isUuid(value), false);
  for (const value of ['A', 'A12345678912345', '123456789012345']) assert.equal(isMerchantRef(value), true);
  for (const value of ['', 'A1234567890123456', 'TEST_1', uuid(10), '../GET', 'é123', 123]) assert.equal(isMerchantRef(value), false);
});

test('an accepted request is never a paid charge, including misleading Success labels', () => {
  for (const rs of [
    { code: 101, status: 'Success', successful: true },
    { code: '101', status: 'Success', successful: true },
    { status: 'Success', successful: true },
    { status: 'Paid', successful: true },
    { code: 100, status: 'Success', successful: false },
    { code: 100, status: 'Success', successful: 'true' },
    { code: 100, status: 'Pending', successful: true },
    { code: 100, status: 'Success' },
  ]) assert.notEqual(normalizeCharge(chargePayload({ responseStatus: rs })).state, 'confirmed');
  assert.equal(normalizeCharge(chargePayload()).state, 'confirmed');
  assert.equal(normalizeCharge(chargePayload({ responseStatus: { code: 101, status: 'Success', successful: true } })).state, 'pending');
});

test('expiration needs explicit provider evidence and an unambiguous timezone', () => {
  assert.equal(normalizeCharge(chargePayload({ responseStatus: { code: 907, status: 'Expired', successful: false } })).state, 'expired');
  assert.notEqual(normalizeCharge(chargePayload({ responseStatus: { status: 'expired' } })).state, 'expired');
  const withDate = dueDate => normalizeCharge(chargePayload({ reference: { referenceNumber: '123456789', entity: '00348', dueDate } }));
  assert.equal(withDate('2026-12-01T23:59:59').dueAt, null);
  assert.equal(withDate('2026-12-01T23:59:59+01:00').dueAt, '2026-12-01T22:59:59.000Z');
  assert.equal(withDate('not-a-date').dueAt, null);
});

test('financial evidence must match every stored identity, currency, channel and amount', () => {
  const a = attempt({ provider_charge_id: uuid(20) });
  const good = normalizeCharge(chargePayload());
  assert.doesNotThrow(() => verifyCharge(good, a, uuid(20), a.merchant));
  for (const patch of [
    { id: uuid(21) }, { id: null }, { merchantRef: 'OTHERORDER' }, { merchantRef: null },
    { amountMinor: 12344 }, { amountMinor: null }, { currency: 'USD' }, { currency: null },
    { method: 'REF' }, { method: null },
  ]) assert.throws(() => verifyCharge({ ...good, ...patch }, a, uuid(20), a.merchant), hasCode('charge_mismatch'));
  assert.throws(() => verifyCharge(good, a, uuid(21), a.merchant), hasCode('charge_mismatch'));
  assert.throws(() => verifyCharge(good, a, uuid(20), 'ANOTHER_MERCHANT'), hasCode('charge_mismatch'));
  assert.throws(() => verifyCharge(good, { ...a, provider_charge_id: uuid(22) }, uuid(20), a.merchant), hasCode('charge_mismatch'));
  assert.equal(normalizeCharge(chargePayload({ amount: 123.451 })).amountMinor, null);
  assert.equal(normalizeCharge(chargePayload({ merchantTransactionId: 'INVALID_TOO_LONG' })).merchantRef, null);
});

test('creation sends only server-controlled sandbox payload and rejects redirects', async () => {
  const calls = [];
  const gateway = new SandboxAppyPay(config({ APPYPAY_BASE_URL: 'https://gwy-api.appypay.co.ao', MASSA_APPYPAY_BASE_URL: 'https://evil.test' }), async (url, init) => {
    calls.push({ url, init });
    return url === SANDBOX_TOKEN ? tokenResponse() : response(chargePayload());
  });
  await gateway.create(attempt());
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, SANDBOX_TOKEN);
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  const oauth = calls[0].init.body;
  assert.equal(oauth.get('grant_type'), 'client_credentials');
  assert.equal(oauth.get('client_secret'), config().clientSecret);
  assert.equal(calls[1].url, `${SANDBOX_GATEWAY}/v2.0/charges`);
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    amount: 123.45, currency: 'AOA', description: 'MASSA sandbox',
    merchantTransactionId: attempt().merchant_ref, paymentMethod: config().gpoKey,
    paymentInfo: { phoneNumber: '900000000' },
  });
  for (const call of calls) {
    assert.equal(call.init.redirect, 'error');
    assert.ok(call.init.signal instanceof AbortSignal);
  }
});

test('REF uses the provisioned automatic-reference contract without fabricated dates or reference numbers', async () => {
  let posted;
  const gateway = new SandboxAppyPay(config(), async (url, init) => {
    if (url === SANDBOX_TOKEN) return tokenResponse();
    posted = JSON.parse(init.body);
    return response(chargePayload({ responseStatus: { code: 101, status: 'Success', successful: true, source: 'REF', reference: { entity: '00348', referenceNumber: '123456789' } } }));
  });
  const charge = await gateway.create(attempt({ method: 'REF', phone: null }));
  assert.equal(posted.paymentMethod, config().refKey);
  assert.equal(Object.hasOwn(posted, 'paymentInfo'), false);
  assert.equal(charge.state, 'pending');
  assert.equal(charge.reference, '123456789');
  assert.equal(charge.entity, '00348');
});

test('unsafe creation input cannot trigger even an OAuth request', async () => {
  const gateway = new SandboxAppyPay(config(), async () => { throw new Error('unexpected network'); });
  for (const patch of [
    { merchant: 'OTHER' }, { merchant_ref: 'INVALID_REF' }, { method: 'UMM' },
    { currency: 'USD' }, { amount_minor: 1.5 }, { phone: '923456789' }, { phone: '244900000000' },
  ]) {
    await assert.rejects(gateway.create(attempt(patch)), error => {
      assert.ok(error instanceof GatewayError);
      assert.ok(['invalid_attempt', 'invalid_amount', 'invalid_test_phone'].includes(error.code), error.code);
      return true;
    });
  }
  await assert.rejects(gateway.get(`${uuid(20)}?other=1`), hasCode('invalid_charge_id'));
});

test('POST timeout is uncertain and never re-submitted by the transport', async () => {
  let posts = 0;
  const gateway = new SandboxAppyPay(config(), async url => {
    if (url === SANDBOX_TOKEN) return tokenResponse();
    posts++;
    throw new DOMException('fake network timeout', 'TimeoutError');
  });
  await assert.rejects(gateway.create(attempt()), hasCode('creation_uncertain', true));
  assert.equal(posts, 1);
});

test('duplicate references, server errors and malformed POST responses remain uncertain without retries', async () => {
  for (const [outcome, expected] of [
    [() => response({ error: 'already exists' }, 409), 'reference_conflict'],
    [() => response({ error: 'upstream failure' }, 500), 'creation_uncertain'],
    [() => new Response('not JSON', { status: 200 }), 'creation_uncertain'],
    [() => Response.redirect('https://gwy-api.appypay.co.ao/v2.0/charges', 307), 'creation_uncertain'],
  ]) {
    let posts = 0;
    const gateway = new SandboxAppyPay(config(), async url => {
      if (url === SANDBOX_TOKEN) return tokenResponse();
      posts++;
      return outcome();
    });
    await assert.rejects(gateway.create(attempt()), hasCode(expected, true));
    assert.equal(posts, 1);
  }
});

test('an authentication failure creates no charge and provider error text is not exposed', async () => {
  let calls = 0;
  const gateway = new SandboxAppyPay(config(), async () => {
    calls++;
    return response({ error_description: `untrusted error containing ${config().clientSecret}` }, 400);
  });
  await assert.rejects(gateway.create(attempt()), error => {
    assert.equal(error.code, 'authentication_rejected');
    assert.equal(error.message.includes(config().clientSecret), false);
    return true;
  });
  assert.equal(calls, 1);
});

test('token cache renews before expiry using the provider lifetime', async () => {
  let now = 1_000_000, authentications = 0;
  const tokensUsed = [];
  const gateway = new SandboxAppyPay(config(), async (url, init) => {
    if (url === SANDBOX_TOKEN) return tokenResponse({ access_token: `token-${++authentications}`, expires_in: 90 });
    tokensUsed.push(init.headers.Authorization);
    return response(chargePayload());
  }, () => now);
  await gateway.get(uuid(20));
  now += 59_999;
  await gateway.get(uuid(20));
  assert.equal(authentications, 1);
  now += 1;
  await gateway.get(uuid(20));
  assert.equal(authentications, 2);
  assert.deepEqual(tokensUsed, ['Bearer token-1', 'Bearer token-1', 'Bearer token-2']);
});

test('concurrent operations share a single in-flight token request', async () => {
  let release;
  const pendingToken = new Promise(resolve => { release = resolve; });
  let authentications = 0, queries = 0;
  const gateway = new SandboxAppyPay(config(), async url => {
    if (url === SANDBOX_TOKEN) { authentications++; await pendingToken; return tokenResponse(); }
    queries++;
    return response(chargePayload());
  });
  const requests = [gateway.get(uuid(20)), gateway.get(uuid(21)), gateway.get(uuid(22))];
  assert.equal(authentications, 1);
  release();
  await Promise.all(requests);
  assert.equal(authentications, 1);
  assert.equal(queries, 3);
});

test('GET may refresh once after 401; financial POST is never retried after 401', async () => {
  let auths = 0, gets = 0;
  const gateway = new SandboxAppyPay(config(), async url => {
    if (url === SANDBOX_TOKEN) { auths++; return tokenResponse(); }
    return ++gets === 1 ? response({}, 401) : response(chargePayload());
  });
  assert.equal((await gateway.get(uuid(20))).state, 'confirmed');
  assert.equal(auths, 2);
  assert.equal(gets, 2);
  let posts = 0;
  const posting = new SandboxAppyPay(config(), async url => {
    if (url === SANDBOX_TOKEN) return tokenResponse();
    posts++;
    return response({}, 401);
  });
  await assert.rejects(posting.create(attempt()), hasCode('creation_rejected', false));
  assert.equal(posts, 1);
});

test('invalid token metadata and token redirects fail before a financial request', async () => {
  for (const result of [
    () => tokenResponse({ token_type: 'Basic' }), () => tokenResponse({ access_token: '' }),
    () => tokenResponse({ expires_in: 0 }), () => tokenResponse({ expires_in: 'forever' }),
    () => Response.redirect('https://evil.test/token', 302),
  ]) {
    let calls = 0;
    const gateway = new SandboxAppyPay(config(), async (_url, init) => {
      calls++;
      assert.equal(init.redirect, 'error');
      return result();
    });
    await assert.rejects(gateway.create(attempt()));
    assert.equal(calls, 1);
  }
});

test('external JSON is bounded and must be an object', async () => {
  assert.deepEqual(await readJsonBody(response({ ok: true })), { ok: true });
  for (const value of [null, ['unexpected'], 'text', 42]) await assert.rejects(readJsonBody(response(value)), hasCode('invalid_json'));
  await assert.rejects(readJsonBody(new Response('broken')), hasCode('invalid_json'));
  await assert.rejects(readJsonBody(response({ huge: 'x'.repeat(70_000) })), hasCode('body_too_large'));
});

test('public projection cannot expose merchant credentials, telephone or raw gateway evidence', () => {
  const safe = publicAttempt({ ...attempt(), clientSecret: 'do-not-expose', token: 'secret-token', raw: { private: true } });
  for (const key of ['merchant', 'merchant_ref', 'phone', 'clientSecret', 'token', 'raw', 'actor_id', 'beneficiary_id']) {
    assert.equal(Object.hasOwn(safe, key), false, key);
  }
  assert.equal(safe.amount_minor, 12345);
  assert.equal(safe.state, 'submitting');
  assert.equal(publicAttempt(null), null);
});

test('shared-token checks fail closed for absent, different and oversized values', async () => {
  assert.equal(await equalSecret('', ''), false);
  assert.equal(await equalSecret('same', ''), false);
  assert.equal(await equalSecret('bad', 'expected'), false);
  assert.equal(await equalSecret('x'.repeat(4097), 'expected'), false);
  assert.equal(await equalSecret('expected', 'expected'), true);
});
