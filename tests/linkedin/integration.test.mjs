import test from 'node:test';
import assert from 'node:assert/strict';
import { handleLinkedIn } from '../../server/linkedin/handler.mjs';
import { seal, unseal, encryptionKey, uploadUrl, mediaSpec, returnPath, digest } from '../../server/linkedin/security.mjs';
import { provider, ProviderError } from '../../server/linkedin/provider.mjs';
const user = '11111111-1111-4111-8111-111111111111', post = '22222222-2222-4222-8222-222222222222';
const env = { LINKEDIN_PUBLISH_ENABLED: 'true', LINKEDIN_CLIENT_ID: 'app', LINKEDIN_CLIENT_SECRET: 'secret', LINKEDIN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), LINKEDIN_ORIGIN: 'https://www.yamilook.com', LINKEDIN_API_VERSION: '202610', SUPABASE_SERVICE_ROLE_KEY: 'service', VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'public' };
const key = encryptionKey(env.LINKEDIN_ENCRYPTION_KEY);
function fixture() {
  const rows = { connections: [{ user_id: user, subject: 'member', display_name: 'Tony', token_ciphertext: seal('access', key, user), expires_at: '2099-01-01' }], oauth_states: [], drafts: [], upload_parts: [] };
  const matches = (row, filters) => Object.entries(filters || {}).every(([name, rule]) => {
    if (['select', 'limit', 'order'].includes(name)) return true;
    if (rule.startsWith('eq.')) return String(row[name]) === rule.slice(3);
    if (rule.startsWith('gt.')) return String(row[name]) > rule.slice(3);
    if (rule.startsWith('in.(')) return rule.slice(4, -1).split(',').includes(row[name]);
    throw new Error('unknown filter');
  });
  const calls = [];
  const db = {
    async authenticate(token) { if (token !== 'Bearer session') throw new Error('unauthorized'); return user; },
    async post(id) { if (id !== post) throw new Error('post_unavailable'); return 'fingerprint'; },
    async get(table, filters) { return structuredClone(rows[table].filter(row => matches(row, filters))); },
    async delete(table, filters) { const found = rows[table].filter(row => matches(row, filters)); rows[table] = rows[table].filter(row => !matches(row, filters)); return found; },
    async insert(table, body, upsert) {
      if (upsert) {
        const existing = rows[table].find(row => table === 'connections' ? row.user_id === body.user_id : row.draft_id === body.draft_id && row.part === body.part);
        if (existing) { Object.assign(existing, body); return [existing]; }
      }
      const row = { created_at: new Date().toISOString(), expires_at: '2099-01-01', ...body }; rows[table].push(row); return [row];
    },
    async patch(table, filters, body) { const found = rows[table].filter(row => matches(row, filters)); found.forEach(row => Object.assign(row, body)); return structuredClone(found); },
  };
  const api = {
    async initialize(kind, owner, size) { calls.push(['initialize', kind, owner]); return { media: `urn:li:${kind}:asset`, parts: [{ uploadUrl: 'https://www.linkedin.com/dms-uploads/asset', firstByte: 0, lastByte: size - 1 }], uploadToken: '' }; },
    async upload(part, bytes) { calls.push(['upload', bytes.toString()]); return 'etag'; },
    async finalize() { calls.push(['finalize']); },
    async ready() { return true; },
    async publish(owner, media, text, visibility) { calls.push(['publish', owner, media, text, visibility]); return 'urn:li:share:123'; },
  };
  const request = async (action, body = {}, options = {}) => {
    const query = new URLSearchParams({ action, ...(options.query || {}) });
    const method = ['status','draft','callback'].includes(action) ? 'GET' : 'POST';
    if (method === 'GET' && body.draft) query.set('draft', body.draft);
    const req = new Request(`${env.LINKEDIN_ORIGIN}/api/linkedin?${query}`, { method, headers: { authorization: 'Bearer session', origin: env.LINKEDIN_ORIGIN, ...options.headers }, body: method === 'GET' ? undefined : action === 'upload' ? body : JSON.stringify(body) });
    return handleLinkedIn(req, { env, db, makeProvider: () => api, ...options.deps });
  };
  const prepare = async (type = 'video/mp4') => {
    const init = await (await request('initialize', { postId: post, type, size: 4 })).json();
    assert.ok(init.id);
    await request('upload', 'data', { query: { draft: init.id, part: '0' } });
    await request('finalize', { draft: init.id });
    await request('draft', { draft: init.id });
    return init.id;
  };
  return { rows, db, api, calls, request, prepare };
}
test('encryption is random, authenticated and bound to the owner', () => {
  const cipher = seal('secret', key, user); assert.equal(unseal(cipher, key, user), 'secret');
  assert.notEqual(cipher, seal('secret', key, user));
  assert.throws(() => unseal(cipher, key, post)); assert.throws(() => unseal(cipher.slice(0, -4) + 'aaaa', key, user));
});
test('rejects unsafe upload destinations, oversized files and cross-origin return URLs', () => {
  for (const url of ['http://www.linkedin.com/dms-uploads/a','https://evil.test/a','https://www.linkedin.com.evil.test/dms-uploads/a','https://user@www.linkedin.com/dms-uploads/a','https://www.linkedin.com:8443/dms-uploads/a','https://www.linkedin.com/oauth/a']) assert.throws(() => uploadUrl(url));
  assert.throws(() => mediaSpec('text/html', 10)); assert.throws(() => mediaSpec('image/png', 4194305));
  assert.equal(returnPath('//evil.test'), '/'); assert.equal(returnPath('/\\evil.test'), '/');
});
test('configuration switch fails closed without making authenticated calls', async () => {
  const response = await handleLinkedIn(new Request('https://www.yamilook.com/api/linkedin'), { env: {}, db: {} });
  assert.deepEqual(await response.json(), { enabled: false, connected: false });
});
test('requires validated login and same-origin mutations', async () => {
  const f = fixture();
  assert.equal((await f.request('status', {}, { headers: { authorization: 'Bearer forged' } })).status, 401);
  assert.equal((await f.request('connect', {}, { headers: { origin: 'https://evil.test' } })).status, 403);
});
test('OAuth state is bound to the browser and one-use before exchanging a code', async () => {
  const f = fixture();
  const start = await f.request('connect', { returnPath: '/feed' });
  const destination = new URL((await start.json()).url), state = destination.searchParams.get('state');
  assert.equal(destination.searchParams.get('scope'), 'openid profile w_member_social');
  assert.match(start.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Lax/);
  assert.equal(f.rows.oauth_states[0].state_hash, digest(state));
  const query = { state, error: 'access_denied' };
  assert.equal((await f.request('callback', {}, { query })).status, 400);
  const headers = { cookie: `__Host-yamilook-linkedin-state=${state}` };
  const cancelled = await f.request('callback', {}, { query, headers });
  assert.equal(cancelled.status, 303); assert.match(cancelled.headers.get('location'), /linkedin=cancelled/);
  assert.equal((await f.request('callback', {}, { query, headers })).status, 400);
});
test('rejects non-owned posts and cross-user draft access', async () => {
  const f = fixture();
  assert.equal((await f.request('initialize', { postId: user, type: 'image/png', size: 4 })).status, 400);
  const id = await f.prepare(); f.rows.drafts[0].user_id = post;
  assert.equal((await f.request('draft', { draft: id })).status, 404);
});
test('exact prepared bytes are uploaded; no token or upload URL reaches the client', async () => {
  const f = fixture(); const response = await f.request('initialize', { postId: post, type: 'video/mp4', size: 4 }); const job = await response.json();
  assert.deepEqual(Object.keys(job).sort(), ['id','parts']);
  assert.equal((await f.request('upload', 'bad', { query: { draft: job.id, part: '0' } })).status, 400);
  assert.equal((await f.request('finalize', { draft: job.id })).status, 409);
  await f.request('upload', 'data', { query: { draft: job.id, part: '0' } });
  assert.deepEqual(f.calls.at(-1), ['upload', 'data']);
});
test('requires explicit confirmation and current source ownership; publishes once under concurrent requests', async () => {
  const f = fixture(), id = await f.prepare();
  const body = { draft: id, commentary: 'África moderna', visibility: 'PUBLIC', confirm: true };
  assert.equal((await f.request('publish', { ...body, confirm: false })).status, 400);
  const results = await Promise.all([f.request('publish', body), f.request('publish', body)]);
  assert.ok(results.some(r => r.status === 200)); assert.equal(f.calls.filter(c => c[0] === 'publish').length, 1);
  const retry = await f.request('publish', body); assert.equal((await retry.json()).postId, 'urn:li:share:123');
  assert.equal(f.calls.filter(c => c[0] === 'publish').length, 1);
});
test('a changed source blocks publication', async () => {
  const f = fixture(), id = await f.prepare('image/png'); f.db.post = async () => 'changed';
  assert.equal((await f.request('publish', { draft: id, commentary: '', visibility: 'PUBLIC', confirm: true })).status, 409);
  assert.equal(f.calls.filter(c => c[0] === 'publish').length, 0);
});
test('uncertain provider outcomes cannot be retried as another create request', async () => {
  const f = fixture(), id = await f.prepare(); let attempts = 0;
  f.api.publish = async () => { attempts++; throw new Error('network timeout'); };
  const body = { draft: id, commentary: '', visibility: 'CONNECTIONS', confirm: true };
  assert.equal((await f.request('publish', body)).status, 409);
  assert.equal((await f.request('publish', body)).status, 409);
  assert.equal(f.rows.drafts[0].status, 'uncertain'); assert.equal(attempts, 1);
  assert.equal((await f.request('initialize', { postId: post, type: 'video/mp4', size: 4 })).status, 409);
});
test('disconnect removes credentials and invalidates pending drafts', async () => {
  const f = fixture(); await f.prepare(); await f.request('disconnect');
  assert.equal(f.rows.connections.length, 0); assert.equal(f.rows.drafts[0].status, 'failed');
});
test('provider follows documented upload range and Posts API payload', async () => {
  const calls = [];
  const api = provider({ token: 'secret', version: '202610', fetcher: async (url, init) => {
    calls.push([url, init]);
    if (url.includes('initializeUpload')) return Response.json({ value: { video: 'urn:li:video:asset', uploadToken: '', uploadInstructions: [{ uploadUrl: 'https://www.linkedin.com/dms-uploads/asset', firstByte: 0, lastByte: 3 }] } });
    if (url.includes('dms-uploads')) return new Response(null, { headers: { etag: '"part-id"' } });
    return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:123' } });
  } });
  const prepared = await api.initialize('video', 'urn:li:person:member', 4);
  assert.equal(await api.upload(prepared.parts[0], Buffer.from('data'), 'video/mp4'), 'part-id');
  await api.finalize(prepared.media, '', ['part-id']);
  await api.publish('urn:li:person:member', prepared.media, 'Hello', 'PUBLIC');
  assert.equal(JSON.parse(calls.at(-1)[1].body).content.media.id, prepared.media);
  assert.equal(calls.at(-1)[1].headers['Linkedin-Version'], '202610');
  assert.ok(calls.every(([, init]) => init.redirect === 'error'));
});

test('successful OAuth stores encrypted credentials and returns only a safe redirect', async () => {
  const f = fixture();
  const start = await f.request('connect', { returnPath: '//evil.test' });
  const state = new URL((await start.json()).url).searchParams.get('state');
  const requests = [];
  const fetcher = async (url, options) => {
    requests.push([url, options]);
    return url.includes('accessToken') ? Response.json({ access_token: 'new-private-token', expires_in: 3600, scope: 'openid profile w_member_social' }) : Response.json({ sub: 'member2', name: 'Tony' });
  };
  const response = await f.request('callback', {}, { query: { state, code: 'private-code' }, headers: { cookie: `__Host-yamilook-linkedin-state=${state}` }, deps: { fetcher } });
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), 'https://www.yamilook.com/?linkedin=connected');
  assert.equal(unseal(f.rows.connections[0].token_ciphertext, key, user), 'new-private-token');
  assert.equal(f.rows.connections[0].subject, 'member2');
  assert.ok(!JSON.stringify(f.rows.connections[0]).includes('new-private-token'));
  assert.equal(requests.length, 2); assert.equal(await response.text(), '');
});
