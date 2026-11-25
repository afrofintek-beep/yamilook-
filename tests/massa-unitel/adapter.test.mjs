import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Pure local tests. Every transport is injected; these fictitious endpoints are never contacted.
const source = await readFile(new URL('../../supabase/functions/_shared/massa-unitel.ts', import.meta.url), 'utf8');
const compiled = `${stripTypeScriptTypes(source)}\n//# sourceURL=${new URL('../../supabase/functions/_shared/massa-unitel.ts', import.meta.url).href}`;
const api = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const { loadSandboxConfig, SandboxUnitelMoney, UnitelError, amountFromMinor, normalizeAcceptance,
  normalizeQuery, parseCallback, publicAttempt, readJsonBody, equalSecret, hashEvent } = api;

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const sandboxRef = 'abcdefghijklmnopqrst';
const host = 'sandbox-unit-tests.unitel.co.ao';
const tokenUrl = `https://${host}:8343/test-token`;
const baseUrl = `https://${host}:8343/test-partners/1.0.0`;
const values = (overrides = {}) => ({
  MASSA_UNITEL_ENABLED: 'sandbox', MASSA_UNITEL_SANDBOX_CONFIRMED: 'true',
  MASSA_UNITEL_SANDBOX_PROJECT_REF: sandboxRef, SUPABASE_URL: `https://${sandboxRef}.supabase.co`,
  MASSA_UNITEL_ALLOWED_HOSTS: host, MASSA_UNITEL_TOKEN_URL: tokenUrl, MASSA_UNITEL_API_BASE_URL: baseUrl,
  MASSA_UNITEL_CLIENT_ID: 'unit-test-consumer-key', MASSA_UNITEL_CLIENT_SECRET: 'unit-test-consumer-secret',
  MASSA_UNITEL_OPERATOR: 'unit-test-operator', MASSA_UNITEL_SECURITY_CREDENTIAL: 'unit-test-encrypted-placeholder',
  MASSA_UNITEL_MERCHANT_ID: 'TEST_MERCHANT', MASSA_UNITEL_POS_DEVICE_ID: 'TEST_TERMINAL',
  MASSA_UNITEL_CALLBACK_URL: `https://${sandboxRef}.supabase.co/functions/v1/massa-unitel-webhook`,
  MASSA_UNITEL_ALLOWED_USERS: uuid(1), MASSA_UNITEL_ALLOWED_BENEFICIARIES: uuid(2),
  MASSA_UNITEL_ALLOWED_PHONES: '900000101,900000102', MASSA_UNITEL_ALLOWED_ORIGINS: 'https://sandbox.example.test',
  MASSA_UNITEL_RECONCILE_TOKEN: 'unit-test-reconciliation-secret-at-least-32-characters', ...overrides,
});
const config = overrides => { const env = values(overrides); return loadSandboxConfig(key => env[key]); };
const attempt = (overrides = {}) => ({
  id: uuid(10), request_id: uuid(11), order_id: uuid(12), actor_id: uuid(1), beneficiary_id: uuid(2),
  amount_minor: 12345, currency: 'AOA', phone: '900000101', merchant: 'TEST_MERCHANT', merchant_ref: 'MU_TEST_20261125_01',
  provider_conversation_id: null, provider_transaction_id: null, state: 'submitting', issue_code: null, provider_code: null,
  created_at: '2026-11-25T10:00:00.000Z', updated_at: '2026-11-25T10:00:00.000Z', ...overrides,
});
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const token = overrides => json({ access_token: 'unit-test-bearer-token', token_type: 'Bearer', expires_in: 3600, ...overrides });
const accepted = overrides => ({ Response: { OriginatorConversationID: attempt().merchant_ref,
  ConversationID: 'AG_UNIT_TEST_ACCEPTED', ResponseCode: 0, ServiceStatus: 0, ...overrides } });
const completed = overrides => ({ QueryTransStatusRs: { ResultType: 0, ResultCode: 0,
  Transaction: { ReceiptNumber: 'TEST_RECEIPT_01', TransactionStatus: 'Completed' }, ...overrides } });
const hasCode = (code, uncertain) => error => {
  assert.ok(error instanceof UnitelError); assert.equal(error.code, code);
  if (uncertain !== undefined) assert.equal(error.uncertain, uncertain);
  return true;
};

test('sandbox requires explicit confirmation, isolated project, endpoints and operator allowlists', () => {
  assert.ok(config());
  for (const override of [
    { MASSA_UNITEL_ENABLED: undefined }, { MASSA_UNITEL_ENABLED: 'true' }, { MASSA_UNITEL_ENABLED: 'production' },
    { MASSA_UNITEL_SANDBOX_CONFIRMED: undefined }, { MASSA_UNITEL_SANDBOX_CONFIRMED: 'yes' },
    { MASSA_UNITEL_SANDBOX_PROJECT_REF: 'rfayqekonkovfbkwjjum', SUPABASE_URL: 'https://rfayqekonkovfbkwjjum.supabase.co' },
    { SUPABASE_URL: 'https://anotherproject.supabase.co' }, { SUPABASE_URL: `https://${sandboxRef}.supabase.co/unexpected` },
    { MASSA_UNITEL_ALLOWED_HOSTS: '' }, { MASSA_UNITEL_TOKEN_URL: '' }, { MASSA_UNITEL_API_BASE_URL: '' },
    { MASSA_UNITEL_CLIENT_ID: '' }, { MASSA_UNITEL_CLIENT_SECRET: '' }, { MASSA_UNITEL_SECURITY_CREDENTIAL: '' },
    { MASSA_UNITEL_OPERATOR: '' }, { MASSA_UNITEL_POS_DEVICE_ID: '' },
    { MASSA_UNITEL_ALLOWED_USERS: '' }, { MASSA_UNITEL_ALLOWED_USERS: '*' },
    { MASSA_UNITEL_ALLOWED_BENEFICIARIES: '' }, { MASSA_UNITEL_ALLOWED_BENEFICIARIES: '*' },
    { MASSA_UNITEL_ALLOWED_PHONES: '' }, { MASSA_UNITEL_ALLOWED_PHONES: '244900000101' }, { MASSA_UNITEL_ALLOWED_PHONES: '*' },
    { MASSA_UNITEL_ALLOWED_ORIGINS: '' }, { MASSA_UNITEL_ALLOWED_ORIGINS: 'https://sandbox.example.test,https://user:pass@invalid.test' },
    { MASSA_UNITEL_RECONCILE_TOKEN: 'short' }, { MASSA_UNITEL_WEBHOOK_TOKEN: 'short' },
  ]) assert.equal(config(override), null, Object.keys(override).join(','));
  assert.deepEqual([...config().allowedPhones], ['900000101', '900000102']);
});

test('provider credentials cannot go to arbitrary hosts, IP addresses, insecure URLs or userinfo', () => {
  for (const url of [
    'http://sandbox-unit-tests.unitel.co.ao/token', 'https://localhost/token', 'https://127.0.0.1/token',
    'https://[::1]/token', 'https://evil.test/token', 'https://unitel.co.ao.evil.test/token',
    `https://${host}.evil.test/token`, `https://secret@${host}/token`, `https://${host}/token?secret=1`,
    `https://${host}/token#unexpected`, `https://${host}/%2f/token`, `https://${host}/token\n`,
  ]) assert.equal(config({ MASSA_UNITEL_TOKEN_URL: url }), null, url);
  for (const allowed of ['*', '*.unitel.co.ao', 'evil.test', '127.0.0.1', 'unitel.co.ao.evil.test']) {
    assert.equal(config({ MASSA_UNITEL_ALLOWED_HOSTS: allowed }), null, allowed);
  }
  assert.equal(config({ MASSA_UNITEL_TOKEN_URL: 'https://another-host.unitel.co.ao/token' }), null);
  for (const url of ['https://evil.test/callback', `https://${sandboxRef}.supabase.co/functions/v1/other`,
    'https://rfayqekonkovfbkwjjum.supabase.co/functions/v1/massa-unitel-webhook',
    `https://${sandboxRef}.supabase.co/functions/v1/massa-unitel-webhook?token=secret`]) {
    assert.equal(config({ MASSA_UNITEL_CALLBACK_URL: url }), null);
  }
  assert.throws(() => new SandboxUnitelMoney({ ...config(), tokenUrl: 'https://evil.test/token' }), hasCode('invalid_configuration'));
});

test('exact minor-unit amounts reject rounding, zero, negative and overflow', () => {
  assert.equal(amountFromMinor(1), '0.01'); assert.equal(amountFromMinor(12345), '123.45');
  assert.equal(amountFromMinor(100_000_000), '1000000.00');
  for (const amount of [0, -1, 1.1, NaN, Infinity, 100_000_001, Number.MAX_SAFE_INTEGER, '123']) {
    assert.throws(() => amountFromMinor(amount), hasCode('invalid_amount'));
  }
});

test('creation uses the documented BuyGoodRec envelope, Basic OAuth and a single financial POST', async () => {
  const calls = [];
  const gateway = new SandboxUnitelMoney(config(), async (url, init) => {
    calls.push({ url, init }); return url === tokenUrl ? token() : json(accepted());
  }, () => Date.parse('2026-11-25T10:20:30Z'));
  const result = await gateway.create(attempt());
  assert.equal(result.state, 'pending'); assert.equal(result.conversationId, 'AG_UNIT_TEST_ACCEPTED');
  assert.equal(calls.length, 2); assert.equal(calls[0].init.redirect, 'error'); assert.equal(calls[1].init.redirect, 'error');
  assert.equal(calls[0].init.headers.Authorization, `Basic ${Buffer.from('unit-test-consumer-key:unit-test-consumer-secret').toString('base64')}`);
  assert.equal(String(calls[0].init.body), 'grant_type=client_credentials');
  assert.equal(calls[1].url, `${baseUrl}/buyGoods_async`);
  const request = JSON.parse(calls[1].init.body).BuyGoodRec;
  assert.equal(request.Timestamp, '20261125112030');
  assert.equal(request.OriginatorConversationID, attempt().merchant_ref);
  assert.deepEqual(request.TransactionRequest.Parameters, { Amount: '123.45', Currency: 'AOA' });
  assert.equal(request.IdentityRec.Initiator.SecurityCredential, config().securityCredential);
  assert.deepEqual(request.IdentityRec.PrimaryParty, { IdentifierType: 1, Identifier: '900000101' });
  assert.deepEqual(request.IdentityRec.ReceiverParty, { IdentifierType: 4, Identifier: 'TEST_MERCHANT' });
  assert.equal(request.ReferenceData.ReferenceItem.find(item => item.Key === 'Callback').Value, config().callbackUrl);
});

test('unlisted phones, users, beneficiaries, missing orders and changed merchant never reach OAuth', async () => {
  let calls = 0;
  const gateway = new SandboxUnitelMoney(config(), async () => { calls++; return token(); });
  for (const overrides of [{ phone: '923123456' }, { actor_id: uuid(99) }, { beneficiary_id: uuid(99) },
    { order_id: null }, { currency: 'USD' }, { merchant: 'OTHER' }, { amount_minor: 0 }, { merchant_ref: 'bad reference' }]) {
    await assert.rejects(gateway.create(attempt(overrides))); assert.equal(calls, 0);
  }
});

test('acceptance and callback success never mean a confirmed payment', () => {
  assert.equal(normalizeAcceptance(accepted(), attempt()).state, 'pending');
  assert.equal(normalizeAcceptance(accepted({ ServiceStatus: 1 }), attempt()).state, 'uncertain');
  assert.equal(normalizeAcceptance(accepted({ ResponseCode: 3015 }), attempt()).state, 'uncertain');
  const mismatch = normalizeAcceptance(accepted({ OriginatorConversationID: 'OTHER' }), attempt());
  assert.equal(mismatch.state, 'review'); assert.equal(mismatch.conversationId, null);
  assert.equal(normalizeAcceptance(completed(), attempt()).state, 'review');
  const payload = { OriginatorConversationID: attempt().merchant_ref, ConversationID: 'AG_TEST',
    ResultCode: 0, TransactionResult: { TransactionID: 'TEST_RECEIPT_01' } };
  for (const key of ['ResultBuyGoods', 'Result']) {
    const hint = parseCallback({ [key]: payload });
    assert.equal(hint.merchantRef, attempt().merchant_ref); assert.equal(hint.transactionId, 'TEST_RECEIPT_01');
    assert.equal(Object.hasOwn(hint, 'state'), false);
  }
  assert.equal(parseCallback({ ResultBuyGoods: payload, Result: payload }), null);
  assert.equal(parseCallback({ ResultIndividualB2CPayment: payload }), null);
  assert.equal(parseCallback({ Result: { ...payload, OriginatorConversationID: 'bad ref' } }), null);
});

test('only an authenticated status-query Completed result with a receipt is final evidence', () => {
  const result = normalizeQuery(completed(), attempt(), 'QUERY_01');
  assert.equal(result.state, 'confirmed'); assert.equal(result.merchantRef, attempt().merchant_ref);
  assert.equal(result.transactionId, 'TEST_RECEIPT_01'); assert.equal(Object.hasOwn(result, 'amountMinor'), false);
  for (const override of [{ ResultType: 1 }, { ResultCode: 3011 }, { Transaction: {} },
    { Transaction: { TransactionStatus: 'Completed' } },
    { Transaction: { TransactionStatus: 'Completed', ReceiptNumber: ' ' } },
    { Transaction: { TransactionStatus: 'Reversed', ReceiptNumber: 'TEST_RECEIPT_01' } },
    { Transaction: { TransactionStatus: 'Failed' } }]) {
    assert.notEqual(normalizeQuery(completed(override), attempt(), 'QUERY_01').state, 'confirmed');
  }
  assert.equal(normalizeQuery({ QueryTransactionStatusResult: { ResultCode: 3011, ResultType: 0 } }, attempt(), 'QUERY_01').state, 'uncertain');
  assert.equal(normalizeQuery(accepted(), attempt(), 'QUERY_01').state, 'uncertain');
});

test('contradictory query echoes and a changed receipt require review', () => {
  for (const override of [{ OriginatorConversationID: 'WRONG_QUERY' }, { OriginalConversationID: 'OTHER_PAYMENT' },
    { Transaction: { ReceiptNumber: 'TEST_RECEIPT_01', TransactionStatus: 'Completed', OriginalConversationID: 'OTHER' } }]) {
    const result = normalizeQuery(completed(override), attempt(), 'QUERY_01');
    assert.equal(result.state, 'review'); assert.equal(result.observedPaid, true);
    assert.equal(result.transactionId, 'TEST_RECEIPT_01');
  }
  const conflict = normalizeQuery(completed(), attempt({ provider_transaction_id: 'DIFFERENT_RECEIPT' }), 'QUERY_01');
  assert.equal(conflict.state, 'review'); assert.equal(conflict.observedPaid, true);
  assert.equal(conflict.transactionId, 'TEST_RECEIPT_01');
  assert.equal(normalizeQuery({ ...completed(), QueryTransactionStatusResult: {} }, attempt(), 'QUERY_01').state, 'review');
});

test('provider IDs are bounded to the SQL contract before any persistence', () => {
  for (const invalid of ['x'.repeat(129), 'RECEIPT.with.dot', 'RECEIPT:colon', 'bad receipt']) {
    const acceptedResult = normalizeAcceptance(accepted({ ConversationID: invalid }), attempt());
    assert.equal(acceptedResult.state, 'review'); assert.equal(acceptedResult.conversationId, null);
    const queried = normalizeQuery(completed({ Transaction: { ReceiptNumber: invalid, TransactionStatus: 'Completed' } }), attempt(), 'QUERY_01');
    assert.equal(queried.state, 'review'); assert.equal(queried.transactionId, null);
    assert.equal(parseCallback({ Result: { OriginatorConversationID: attempt().merchant_ref, ConversationID: invalid, ResultCode: 0 } }), null);
  }
  assert.equal(normalizeQuery(completed({ Transaction: { ReceiptNumber: 'X'.repeat(128), TransactionStatus: 'Completed' } }), attempt(), 'QUERY_01').state, 'confirmed');
});

test('status lookup uses the original stored request even without a callback or provider ID', async () => {
  let request;
  const gateway = new SandboxUnitelMoney(config(), async (url, init) => {
    if (url === tokenUrl) return token();
    assert.equal(url, `${baseUrl}/queryTransactionStatus_sync`); assert.equal(init.method, 'POST');
    request = JSON.parse(init.body).QueryTransactionStatus;
    return json(completed({ OriginatorConversationID: request.OriginatorConversationID }));
  });
  const result = await gateway.query(attempt());
  assert.equal(result.state, 'confirmed');
  assert.equal(request.QueryTransactionStatusRequest.OriginalConversationID, attempt().merchant_ref);
  assert.notEqual(request.OriginatorConversationID, attempt().merchant_ref);
  assert.equal(Object.hasOwn(request.QueryTransactionStatusRequest, 'ReceiptNumber'), false);
});

test('reconciliation survives phone redaction and removal from the current creation allowlists', async () => {
  const restricted = config();
  restricted.allowedUsers.clear(); restricted.allowedBeneficiaries.clear(); restricted.allowedPhones.clear();
  let queries = 0;
  const gateway = new SandboxUnitelMoney(restricted, async (url, init) => {
    if (url === tokenUrl) return token();
    queries++;
    const body = JSON.parse(init.body).QueryTransactionStatus;
    assert.equal(body.QueryTransactionStatusRequest.OriginalConversationID, attempt().merchant_ref);
    assert.equal(Object.hasOwn(body.IdentityRec, 'PrimaryParty'), false);
    return json(completed());
  });
  assert.equal((await gateway.query(attempt({ phone: null }))).state, 'confirmed');
  assert.equal(queries, 1);
  await assert.rejects(gateway.create(attempt()), hasCode('invalid_attempt'));
  assert.equal(queries, 1);
});

test('financial timeouts, malformed replies, conflicts and server failures are uncertain without retry', async () => {
  for (const outcome of [() => { throw new Error('network timeout'); }, () => json({}, 409), () => json({}, 500),
    () => new Response('invalid JSON'), () => Response.redirect('https://evil.test', 307)]) {
    let posts = 0;
    const gateway = new SandboxUnitelMoney(config(), async url => {
      if (url === tokenUrl) return token(); posts++; return outcome();
    });
    await assert.rejects(gateway.create(attempt()), hasCode('creation_uncertain', true)); assert.equal(posts, 1);
  }
});

test('token is refreshed once after a query 401 but a financial POST is never replayed', async () => {
  let auths = 0, queries = 0;
  const gateway = new SandboxUnitelMoney(config(), async url => {
    if (url === tokenUrl) { auths++; return token(); }
    return ++queries === 1 ? json({}, 401) : json(completed());
  });
  assert.equal((await gateway.query(attempt())).state, 'confirmed');
  assert.equal(auths, 2); assert.equal(queries, 2);
  let posts = 0;
  const posting = new SandboxUnitelMoney(config(), async url => {
    if (url === tokenUrl) return token(); posts++; return json({}, 401);
  });
  await assert.rejects(posting.create(attempt()), hasCode('creation_rejected', false)); assert.equal(posts, 1);
});

test('tokens are cached with expiry margin and shared across concurrent queries', async () => {
  let now = 1_000_000, auths = 0;
  const used = [];
  const gateway = new SandboxUnitelMoney(config(), async (url, init) => {
    if (url === tokenUrl) return token({ access_token: `unit-test-token-${++auths}`, expires_in: 90 });
    used.push(init.headers.Authorization); return json(completed());
  }, () => now);
  await Promise.all([gateway.query(attempt()), gateway.query(attempt())]);
  assert.equal(auths, 1); now += 59_999; await gateway.query(attempt()); assert.equal(auths, 1);
  now++; await gateway.query(attempt()); assert.equal(auths, 2);
  assert.deepEqual(used, ['Bearer unit-test-token-1', 'Bearer unit-test-token-1', 'Bearer unit-test-token-1', 'Bearer unit-test-token-2']);
});

test('token redirects and invalid metadata fail before a financial request; secret errors stay redacted', async () => {
  for (const result of [() => token({ token_type: 'Basic' }), () => token({ access_token: '' }),
    () => token({ expires_in: 0 }), () => token({ expires_in: 'forever' }),
    () => Response.redirect('https://evil.test/token', 302),
    () => json({ error_description: config().clientSecret }, 400)]) {
    let calls = 0;
    const gateway = new SandboxUnitelMoney(config(), async (_url, init) => {
      calls++; assert.equal(init.redirect, 'error'); return result();
    });
    await assert.rejects(gateway.create(attempt()), error => {
      assert.equal(error.message.includes(config().clientSecret), false); return true;
    });
    assert.equal(calls, 1);
  }
});

test('external JSON is bounded and must be an object', async () => {
  assert.deepEqual(await readJsonBody(json({ ok: true })), { ok: true });
  for (const value of [null, [], 'not-an-object', 1]) await assert.rejects(readJsonBody(json(value)), hasCode('invalid_json'));
  await assert.rejects(readJsonBody(new Response('invalid')), hasCode('invalid_json'));
  await assert.rejects(readJsonBody(json({ huge: 'x'.repeat(70_000) })), hasCode('body_too_large'));
});

test('public projection excludes telephone, identities, secrets and raw provider data', () => {
  const safe = publicAttempt({ ...attempt(), ...config(), raw: { private: true }, access_token: 'secret' });
  for (const key of ['phone', 'merchant', 'merchant_ref', 'actor_id', 'beneficiary_id', 'clientId', 'clientSecret',
    'securityCredential', 'operator', 'tokenUrl', 'callbackUrl', 'raw', 'access_token', 'allowedPhones']) {
    assert.equal(Object.hasOwn(safe, key), false, key);
  }
  assert.equal(safe.method, 'UNITEL_MONEY'); assert.equal(safe.purpose, 'order'); assert.equal(safe.amount_minor, 12345);
  assert.equal(publicAttempt(null), null);
});

test('callback authentication helpers fail closed and event hashes are deterministic', async () => {
  assert.equal(await equalSecret('', ''), false); assert.equal(await equalSecret('a', 'b'), false);
  assert.equal(await equalSecret('expected', 'expected'), true);
  assert.equal(await equalSecret('x'.repeat(4097), 'expected'), false);
  assert.equal(await hashEvent({ ref: 'same', code: 0 }), await hashEvent({ ref: 'same', code: 0 }));
  assert.notEqual(await hashEvent({ ref: 'same', code: 0 }), await hashEvent({ ref: 'same', code: 1 }));
});
