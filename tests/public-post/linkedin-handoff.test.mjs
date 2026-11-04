import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { renderPublicPost } from '../../server/public-post-page.mjs';
const script = readFileSync(new URL('../../public/public-post-share.js', import.meta.url), 'utf8');
const id = 'b2b884db-8edc-4acd-8739-07a32eee320a';
const url = `https://www.yamilook.com/post/${id}`;
function setup(share, writeText) {
  const html = renderPublicPost({ id, author: { display_name: 'Tony' }, content: 'Test', created_at: '2026-11-04', media_urls: ['https://example.test/video.mp4'] });
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  Object.defineProperties(dom.window.navigator, { share: { value: share }, clipboard: { value: { writeText } } });
  dom.window.eval(script);
  return dom;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('public LinkedIn entry offers an explicit file or link choice, not immediate navigation', () => {
  const dom = setup();
  try {
    const { document } = dom.window;
    assert.equal(document.querySelector('.linkedin-options summary').textContent, 'LinkedIn');
    assert.ok(document.getElementById('linkedin-prepare-video'));
    assert.equal(document.getElementById('linkedin-native-share').hidden, true);
    assert.ok(document.getElementById('linkedin-copy'));
  } finally { dom.window.close(); }
});

test('public page copies the exact URL and provides instructions after handoff', async () => {
  let copied;
  const dom = setup(undefined, async value => { copied = value; });
  try {
    dom.window.document.getElementById('linkedin-copy').click();
    await settle();
    assert.equal(copied, url);
    assert.match(dom.window.document.getElementById('dialog-share-status').textContent, /Abre a aplicação LinkedIn/);
  } finally { dom.window.close(); }
});

test('public native handoff is not reported as a completed publication', async () => {
  let payload;
  const dom = setup(async value => { payload = value; });
  try {
    const { document } = dom.window;
    document.getElementById('linkedin-native-share').click();
    await settle();
    assert.equal(payload.url, url);
    assert.match(document.getElementById('dialog-share-status').textContent, /não recebe confirmação/);
    assert.doesNotMatch(document.getElementById('dialog-share-status').textContent, /Partilha concluída/);
  } finally { dom.window.close(); }
});
