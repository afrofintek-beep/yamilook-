import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { loadPublicPost, isPostId, safeMediaUrl, postUrl } from '../../shared/public-post.mjs';
import { renderPublicPost } from '../../server/public-post-page.mjs';
import handler from '../../api/public-post.js';
const id = 'be23e228-a441-44ea-a14c-5368fd8097a7';
const row = { id, user_id: 'author', privacy: 'everyone', is_hidden: false, type: 'video', content: 'Olá <script>alert(1)</script>', media_urls: ['https://example.com/video.mp4'], created_at: '2026-11-03T08:00:00Z' };
const options = (post = row) => ({ url: 'https://example.supabase.co', key: 'public-key', fetcher: async (url) => Response.json(url.includes('/rpc/') ? [{ id: 'author', display_name: 'Tony', username: 'tony' }] : [post]) });
test('public page contains the complete text, video controls and social metadata without JavaScript', async () => {
  const post = await loadPublicPost(id, options());
  const html = renderPublicPost(post);
  assert.match(html, /<video controls playsinline/);
  assert.match(html, /property="og:video"/);
  assert.match(html, /property="og:url" content="https:\/\/www.yamilook.com\/post\//);
  assert.match(html, /Olá &lt;script&gt;/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /type="module"|src="\/assets\//);
});
for (const change of [{ privacy: 'contacts' }, { privacy: 'only_me' }, { privacy: 'close_friends' }, { is_hidden: true }]) {
  test(`restricted data is never rendered: ${JSON.stringify(change)}`, async () => {
    assert.equal(await loadPublicPost(id, options({ ...row, ...change })), null);
    assert.doesNotMatch(renderPublicPost(null), /property="og:video"|example.com/);
  });
}
test('invalid IDs never query the backend; unsafe media is excluded', async () => {
  assert.equal(isPostId('x&id=eq.secret'), false);
  assert.equal(await loadPublicPost('x', { fetcher: () => assert.fail('must not fetch') }), null);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', 'http://example.com', 'https://user:pass@example.com']) assert.equal(safeMediaUrl(url), null);
  assert.equal(postUrl(id), `https://www.yamilook.com/post/${id}`);
});
test('requests use only the public key, explicit projection and public visibility filters', async () => {
  let calls = 0;
  await loadPublicPost(id, { ...options(), fetcher: async (url, request) => {
    assert.equal(request.headers.Authorization, 'Bearer public-key');
    assert.equal(request.cache, 'no-store');
    if (++calls === 1) {
      const params = new URL(url).searchParams;
      assert.equal(params.get('privacy'), 'eq.everyone'); assert.equal(params.get('is_hidden'), 'eq.false');
      assert.doesNotMatch(params.get('select'), /hidden_reason|location|\*/);
      return Response.json([row]);
    }
    return Response.json([]);
  } });
  assert.equal(calls, 2);
});
test('anonymous SQL policy exposes only public, non-hidden rows and safe columns', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table public.posts (id text, user_id text, type text, content text, media_urls text[], privacy text, is_hidden boolean, created_at timestamptz, hidden_reason text);
    alter table public.posts enable row level security;
    grant select on public.posts to anon;
    insert into public.posts (id,privacy,is_hidden) values ('public','everyone',false),('hidden','everyone',true),('contacts','contacts',false),('self','only_me',false),('close','close_friends',false);`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261103081046_public_post_sharing.sql', import.meta.url), 'utf8'));
  await db.exec('set role anon');
  assert.deepEqual((await db.query('select id from public.posts')).rows, [{ id: 'public' }]);
  await assert.rejects(db.query('select hidden_reason from public.posts'), /permission denied/);
  await assert.rejects(db.query("update public.posts set privacy='everyone'"), /permission denied/);
  await db.exec('reset role');
  await db.exec("update public.posts set privacy='contacts' where id='public'; set role anon");
  assert.deepEqual((await db.query('select id from public.posts')).rows, []);
  await db.close();
});
function response() { return { headers: {}, code: 0, body: '', setHeader(k,v) { this.headers[k]=v; }, status(c) { this.code=c;return this; }, end(b) { this.body=b;return this; } }; }
test('HTTP rejects mutations, invalid IDs and caches, and returns 503 for outages', async () => {
  const res = response(); await handler({ method:'POST', query:{ id } }, res); assert.equal(res.code,405);
  const missing = response(); await handler({ method:'GET', query:{ id:'invalid' } },missing); assert.equal(missing.code,404);
  assert.match(missing.headers['Cache-Control'], /no-store/); assert.match(missing.body,/noindex/);
  const unavailable = response(); await handler({ method:'GET', query:{ id } },unavailable); assert.equal(unavailable.code,503);
});
