import test from 'node:test';
import assert from 'node:assert/strict';
import { shareDestinations, sharedPostId } from '../../shared/share-destinations.mjs';
import { renderPublicPost } from '../../server/public-post-page.mjs';
const id='be23e228-a441-44ea-a14c-5368fd8097a7';
test('KOSOLOLA is first and every external destination contains the canonical post link',()=>{
  const destinations=shareDestinations(id);assert.equal(destinations[0].id,'kosolola');assert.equal(destinations[0].url,`https://www.kosolola.com/papos-app/share/post/${id}`);
  for(const destination of destinations.slice(1)) assert.ok(decodeURIComponent(destination.url).includes(`https://www.yamilook.com/post/${id}`));
  assert.deepEqual(shareDestinations('bad&id=x'),[]);
});
test('chat cards recognize only exact trusted public post links',()=>{
  assert.equal(sharedPostId(`https://www.yamilook.com/post/${id}`),id);
  for(const url of [`https://evil.com/post/${id}`,`https://www.yamilook.com.evil.com/post/${id}`,`https://me@www.yamilook.com/post/${id}`,`https://www.yamilook.com/post/${id}?secret=x`,`text https://www.yamilook.com/post/${id}`]) assert.equal(sharedPostId(url),null);
});
test('server page renders an accessible destination chooser with KOSOLOLA first',()=>{
  const html=renderPublicPost({id,author:{display_name:'Tony'},content:'Post',created_at:'2026-11-03',media_urls:[]});
  assert.match(html,/<dialog id="share-destinations" aria-labelledby="share-title">/);
  assert.ok(html.indexOf('>KOSOLOLA<')<html.indexOf('>WhatsApp<'));
  assert.match(html,/Mais aplicações/);assert.match(html,/dialog-copy-post/);
});
