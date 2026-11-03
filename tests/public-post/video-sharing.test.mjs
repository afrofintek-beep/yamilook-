import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePostVideo, sharePreparedVideo, canShareVideo, videoDescriptor, videoEndpoint, MAX_PREPARED_VIDEO_BYTES } from '../../shared/post-video-sharing.mjs';
import handler from '../../api/public-post.js';
import { renderPublicPost } from '../../server/public-post-page.mjs';
const id = 'be23e228-a441-44ea-a14c-5368fd8097a7';
const origin = 'https://example.supabase.co';
const url = `${origin}/storage/v1/object/public/media/movie.mp4`;
const post = { id, user_id: 'author', media_urls: ['https://example.com/photo.jpg', url], content: 'AFIS', privacy: 'everyone', is_hidden: false, created_at: '2026-11-03', author: { display_name: 'Tony' } };
const descriptor = videoDescriptor(post, 1, origin);
const metadata = () => Response.json(descriptor);
test('download descriptor selects the requested video and adds the storage download filename', () => {
  assert.equal(videoDescriptor(post, 0, origin), null);
  for (const invalid of [-1, '1x', '1.0', '0&url=evil', 99]) assert.equal(videoDescriptor(post, invalid, origin), null);
  assert.equal(new URL(descriptor.downloadUrl).searchParams.get('download'), `yamilook-${id}-2.mp4`);
  assert.equal(descriptor.type, 'video/mp4');
});
test('preparation downloads a real file without credentials, reports progress and rechecks visibility', async () => {
  const calls = [], progress = [];
  const file = await preparePostVideo(id, 1, { onProgress: (...value) => progress.push(value), fetcher: async (target, options) => {
    calls.push(target); assert.equal(options.credentials, 'omit');
    return target === url ? new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'video/mp4', 'content-length': '3' } }) : metadata();
  } });
  assert.equal(file.name, `yamilook-${id}-2.mp4`); assert.equal(file.type, 'video/mp4'); assert.equal(file.size, 3);
  assert.deepEqual(calls, [videoEndpoint(id,1), url, videoEndpoint(id,1)]); assert.deepEqual(progress, [[3,3]]);
});
test('restricted metadata never starts a media transfer', async () => {
  let calls = 0;
  await assert.rejects(preparePostVideo(id,1,{fetcher: async () => { calls++; return new Response('', {status:404}); }}), /publicamente/);
  assert.equal(calls,1);
});
test('revoking visibility during transfer prevents the prepared file being returned', async () => {
  let calls = 0;
  await assert.rejects(preparePostVideo(id,1,{fetcher: async () => ++calls === 1 ? metadata() : calls === 2 ? new Response(new Uint8Array([1,2,3])) : new Response('', {status:404})}), /alterada/);
});
test('oversized, invalid and empty content fails safely', async () => {
  for (const [body, headers, expected] of [
    [new Uint8Array([1,2,3]), {'content-length': String(MAX_PREPARED_VIDEO_BYTES+1)}, /grande/],
    ['html', {'content-type':'text/html'}, /não é um vídeo/],
    [new Uint8Array(), {}, /vazio/],
  ]) await assert.rejects(preparePostVideo(id,1,{fetcher: async target => target===url ? new Response(body,{headers}) : metadata()}),expected);
});
test('native sharing sends only the File and preserves cancellation and failure', async () => {
  const file = new File(['video'],'video.mp4',{type:'video/mp4'}); let payload;
  assert.equal(await sharePreparedVideo(file,{canShare:()=>true,share:async data=>{payload=data;}}),'shared');
  assert.deepEqual(Object.keys(payload),['files']); assert.equal(payload.files[0],file);
  assert.equal(await sharePreparedVideo(file,{}),'unsupported'); assert.equal(canShareVideo(file,{canShare:()=>{throw Error('blocked');},share:()=>{}}),false);
  assert.equal(await sharePreparedVideo(file,{canShare:()=>true,share:async()=>{throw new DOMException('Cancel','AbortError');}}),'cancelled');
  await assert.rejects(sharePreparedVideo(file,{canShare:()=>true,share:async()=>{throw new DOMException('Denied','NotAllowedError');}}), /Denied/);
});
function response(){return {headers:{}, code:0, setHeader(k,v){this.headers[k]=v;},status(v){this.code=v;return this;},end(body){this.body=body;}};}
test('public video API reuses anonymous filtering, rejects private/deleted content, redirects only to selected media', async t => {
  const env = {...process.env}; const fetch = globalThis.fetch;
  t.after(()=>{process.env=env;globalThis.fetch=fetch;});
  process.env.VITE_SUPABASE_URL=origin;process.env.VITE_SUPABASE_PUBLISHABLE_KEY='public-key';
  for (const row of [post, {...post,privacy:'contacts'}, {...post,is_hidden:true}, null]) {
    globalThis.fetch=async(target,options)=> {assert.equal(options.headers.Authorization,'Bearer public-key');return Response.json(target.includes('/rpc/') ? [] : row ? [row] : []);};
    for (const download of [undefined,'1']) {
      const res=response(); await handler({method:'GET',query:{id,media:'video',index:'1',download}},res);
      const visible=row?.privacy==='everyone' && row?.is_hidden===false;
      assert.equal(res.code, visible ? download ? 302 : 200 : 404);assert.match(res.headers['Cache-Control'],/no-store/);
      if(!visible) assert.equal(res.headers.Location,undefined);
      else if(download) assert.equal(res.headers.Location,descriptor.downloadUrl);
      else assert.equal(JSON.parse(res.body).url,url);
    }
  }
});
test('server chooser exposes video controls only for posts containing videos', () => {
  const html = renderPublicPost(post); assert.match(html,/id="prepare-video"/);assert.match(html,/Partilhar ligação/);assert.match(html,/data-index="1"/);assert.match(html,/type="module" src="\/public-post-video.js"/);
  assert.doesNotMatch(renderPublicPost({...post,media_urls:[]}),/id="prepare-video"/);
});
test('unknown-length oversized streams are cancelled before creating a File', async () => {
  let cancelled=false;
  const chunk=new Uint8Array(1024*1024);
  const stream=new ReadableStream({pull(controller){controller.enqueue(chunk);},cancel(){cancelled=true;}});
  await assert.rejects(preparePostVideo(id,1,{fetcher:async target=>target===url?new Response(stream):metadata()}),/grande/);
  assert.equal(cancelled,true);
});
test('cancelling preparation stops the media stream and prevents sharing a file',async()=>{
  const controller=new AbortController();let cancelled=false;
  const stream=new ReadableStream({pull(streamController){streamController.enqueue(new Uint8Array([1]));},cancel(){cancelled=true;}});
  await assert.rejects(preparePostVideo(id,1,{signal:controller.signal,onProgress:()=>controller.abort(),fetcher:async target=>target===url?new Response(stream):metadata()}),{name:'AbortError'});
  assert.equal(cancelled,true);
});
