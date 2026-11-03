import test from 'node:test';
import assert from 'node:assert/strict';
import { handleOwnedPostMedia } from '../../supabase/functions/owned-post-media/handler.mjs';
import { ownedMediaDescriptor, prepareOwnedMedia, MAX_OWNED_MEDIA_BYTES } from '../../shared/owned-post-media.mjs';

const origin = 'https://example.supabase.co';
const id = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const url = `${origin}/storage/v1/object/public/media/${userId}/photo.jpg`;
const post = { id, user_id: userId, media_urls: [url], privacy: 'only_me', is_hidden: false };
const descriptor = ownedMediaDescriptor(post, 0, origin);
const request = (input = { postId: id, index: 0 }, token = 'user.jwt') => new Request('https://example.test', {
  method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(input),
});
function backend({ row = post, identity = { id: userId }, session = sessionId, authStatus = 200, sessionStatus = 200 } = {}) {
  const calls = [];
  return { calls, fetcher: async (target, options) => {
    calls.push([target, options]);
    assert.equal(options.headers.Authorization, 'Bearer user.jwt');
    assert.equal(options.headers.apikey, 'publishable');
    assert.ok(!target.includes('user.jwt'));
    if (target.endsWith('/auth/v1/user')) return Response.json(identity, { status: authStatus });
    if (target.endsWith('/rpc/account_current_session_id')) return Response.json(session, { status: sessionStatus });
    const params = new URL(target).searchParams;
    assert.equal(params.get('user_id'), `eq.${userId}`);
    assert.equal(params.get('id'), `eq.${id}`);
    assert.equal(params.get('is_hidden'), 'eq.false');
    assert.equal(options.method, undefined); // No write to posts or storage.
    return Response.json(row ? [row] : []);
  } };
}
async function invoke(req, options) { return handleOwnedPostMedia(req, { url: origin, key: 'publishable', ...options }); }

test('only the authenticated owner can export each audience without changing it', async () => {
  for (const privacy of ['everyone', 'contacts', 'close_friends', 'only_me']) {
    const row = { ...post, privacy };
    const b = backend({ row });
    const response = await invoke(request(), b);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), descriptor);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(row.privacy, privacy);
    assert.equal(b.calls.length, 3);
  }
});
test('anonymous, expired and remotely revoked sessions fail before reading a post', async () => {
  const noAuth = backend();
  assert.equal((await invoke(request(undefined, ''), noAuth)).status, 401);
  assert.equal(noAuth.calls.length, 0);
  for (const options of [{ authStatus: 401 }, { identity: { id: userId, is_anonymous: true } }, { sessionStatus: 401 }, { session: null }]) {
    const b = backend(options);
    assert.equal((await invoke(request(), b)).status, 401);
    assert.ok(b.calls.every(([url]) => !url.includes('/posts?')));
  }
});
test('non-owner, deleted and moderated posts never disclose a descriptor', async () => {
  for (const row of [null, { ...post, user_id: sessionId }, { ...post, is_hidden: true }, { ...post, id: sessionId }]) {
    const response = await invoke(request(), backend({ row }));
    assert.equal(response.status, 404);
    assert.ok(!(await response.text()).includes(url));
  }
});
test('rejects invalid input, non-POST and unavailable dependencies', async () => {
  for (const input of [{ postId: 'x', index: 0 }, { postId: id, index: -1 }, { postId: id, index: '0' }]) {
    const b = backend();
    assert.equal((await invoke(request(input), b)).status, 400);
    assert.equal(b.calls.length, 0);
  }
  assert.equal((await invoke(new Request('https://example.test'), backend())).status, 405);
  assert.equal((await invoke(request(), backend({ authStatus: 503 }))).status, 503);
});
test('only existing feed photos/videos on the project storage origin are downloadable', () => {
  for (const source of ['https://evil.test/a.jpg', `${origin}/storage/v1/object/public/chat-files/a.jpg`, `${origin}/storage/v1/object/sign/media/a.jpg`, `${origin}/storage/v1/object/public/media/a.html`, 'invalid']) {
    assert.equal(ownedMediaDescriptor({ ...post, media_urls: [source] }, 0, origin), null);
  }
  for (const index of [-1, 1, NaN, '0']) assert.equal(ownedMediaDescriptor(post, index, origin), null);
  assert.equal(new URL(descriptor.downloadUrl).searchParams.get('download'), descriptor.filename);
  assert.equal(ownedMediaDescriptor({ ...post, media_urls: [url.replace('.jpg', '.mp4')] }, 0, origin).type, 'video/mp4');
});
test('prepares an image file and rechecks ownership after transfer without forwarding credentials', async () => {
  let checks = 0;
  const progress = [];
  const file = await prepareOwnedMedia(async () => { checks++; return descriptor; }, { onProgress: (...args) => progress.push(args), fetcher: async (target, options) => {
    assert.equal(target, url);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.headers, undefined);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/jpeg', 'content-length': '3' } });
  } });
  assert.equal(file.type, 'image/jpeg');
  assert.equal(file.size, 3);
  assert.equal(checks, 2);
  assert.deepEqual(progress, [[3, 3]]);
});
test('session revocation or media changes during download discard the prepared file', async () => {
  for (const changes of ['revoked', 'changed']) {
    let checks = 0;
    await assert.rejects(prepareOwnedMedia(async () => {
      if (++checks === 1) return descriptor;
      if (changes === 'revoked') throw new Error('unauthorized');
      return { ...descriptor, url: url.replace('.jpg', '2.jpg') };
    }, { fetcher: async () => new Response(new Uint8Array([1])) }), /unauthorized|alterada/);
  }
});
test('rejects oversized, unsafe MIME and empty files', async () => {
  for (const [body, headers, pattern] of [
    [new Uint8Array([1]), { 'content-length': String(MAX_OWNED_MEDIA_BYTES + 1) }, /grande/],
    ['<html>', { 'content-type': 'text/html' }, /não é uma/],
    [new Uint8Array(), {}, /vazio/],
  ]) await assert.rejects(prepareOwnedMedia(async () => descriptor, { fetcher: async () => new Response(body, { headers }) }), pattern);
});
test('cancellation stops a stream and never returns the file', async () => {
  const controller = new AbortController();
  let cancelled = false;
  const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array([1])); }, cancel() { cancelled = true; } });
  await assert.rejects(prepareOwnedMedia(async () => descriptor, { signal: controller.signal, onProgress: () => controller.abort(), fetcher: async () => new Response(stream) }), { name: 'AbortError' });
  assert.equal(cancelled, true);
});
