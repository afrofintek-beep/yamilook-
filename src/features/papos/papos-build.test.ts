import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import type { OutputBundle, PluginContext } from 'rollup';
import { paposApplication } from '../../../build/papos-plugin';
const root=resolve(import.meta.dirname,'../../..');
function worker() {
  let source=''; const plugin=paposApplication(); const hook=plugin.generateBundle!;
  const generate=typeof hook==='function'?hook:hook.handler;
  const bundle={
    'papos-app/index.html':{type:'asset',source:'<html>Papos</html>'},
    'assets/papos.js':{type:'chunk',fileName:'assets/papos.js',isEntry:true,name:'papos',code:'papos',imports:['assets/shared.js'],dynamicImports:['assets/chat.js']},
    'assets/shared.js':{type:'chunk',fileName:'assets/shared.js',code:'shared',imports:[],dynamicImports:[]},
    'assets/chat.js':{type:'chunk',fileName:'assets/chat.js',code:'chat',imports:[],dynamicImports:[]},
    'assets/yamilook.js':{type:'chunk',fileName:'assets/yamilook.js',isEntry:true,name:'yamilook',code:'social',imports:[],dynamicImports:[]},
  } as unknown as OutputBundle;
  generate.call({emitFile:(file:{source:string})=>{source=file.source;}} as unknown as PluginContext,{},bundle,false);
  const handlers:Record<string,(event:unknown)=>void>={};
  const fetch=vi.fn().mockRejectedValue(new Error('offline'));
  const cache={addAll:vi.fn().mockResolvedValue(undefined),match:vi.fn().mockResolvedValue({shell:'Papos'}),put:vi.fn().mockResolvedValue(undefined),delete:vi.fn().mockResolvedValue(true)};
  const caches={open:vi.fn().mockResolvedValue(cache),keys:vi.fn().mockResolvedValue([]),delete:vi.fn()};
  runInNewContext(source,{self:{location:{origin:'https://example.com'},addEventListener:(name:string,handler:(event:unknown)=>void)=>{handlers[name]=handler;},skipWaiting:vi.fn(),clients:{claim:vi.fn()}},caches,fetch,URL,Response:{error:()=>({error:true})}});
  return {source,handlers,fetch,cache,caches};
}
describe('Papos independent installation contract',()=>{
  it('has a distinct app ID, entry, scope and icons',()=>{
    const manifest=JSON.parse(readFileSync(resolve(root,'public/papos-app/manifest.webmanifest'),'utf8'));
    expect(manifest).toMatchObject({id:'/papos-app/',start_url:'/papos-app/',scope:'/papos-app/',name:'KOSOLOLA'});
    for(const icon of manifest.icons){ const data=readFileSync(resolve(root,'public'+icon.src)); expect(data.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0])); }
  });
  it('precaches only the shell and static dependencies, without optional routes',async()=>{
    const sw=worker(); let installed!:Promise<unknown>; sw.handlers.install({waitUntil:(promise:Promise<unknown>)=>{installed=promise;}}); await installed;
    expect(sw.cache.addAll).toHaveBeenCalledWith(expect.arrayContaining(['/papos-app/index.html','/assets/papos.js','/assets/shared.js']));
    expect(sw.cache.addAll.mock.calls[0][0]).not.toContain('/assets/yamilook.js');
    expect(sw.cache.addAll.mock.calls[0][0]).not.toContain('/assets/chat.js');
  });
  it('opens the Papos shell on an offline deep link',async()=>{
    const sw=worker();let response!:Promise<unknown>;sw.handlers.fetch({request:{method:'GET',url:'https://example.com/papos-app/chat/id',mode:'navigate'},respondWith:(promise:Promise<unknown>)=>{response=promise;}});
    expect(await response).toEqual({shell:'Papos'}); expect(sw.cache.match).toHaveBeenCalledWith('/papos-app/index.html');
  });
  it.each(['https://project.supabase.co/rest/v1/messages','https://project.supabase.co/storage/v1/object/sign/media/video?token=private','https://example.com/api/messages','https://example.com/muxi'])('does not intercept private requests or another application: %s',url=>{
    const sw=worker();const respondWith=vi.fn();sw.handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith});expect(respondWith).not.toHaveBeenCalled();expect(sw.fetch).not.toHaveBeenCalled();
  });
});

it('caches a requested optional route and serves it offline on the next request', async () => {
  const sw=worker();
  const response={ok:true,headers:new Headers({'Content-Type':'text/javascript'}),clone:()=>({cached:'route'})};
  sw.fetch.mockResolvedValue(response);
  const request={method:'GET',url:'https://example.com/assets/chat.js',mode:'cors'};
  let result!:Promise<unknown>;
  const send=()=>sw.handlers.fetch({request,respondWith:(value:Promise<unknown>)=>{result=value;}});
  send();expect(await result).toBe(response);
  expect(sw.cache.put).toHaveBeenCalledWith(request,{cached:'route'});
  sw.caches.keys.mockResolvedValue(['papos-app-assets-current']);
  sw.cache.match.mockResolvedValue({...response,cached:'route'});
  sw.fetch.mockRejectedValue(new Error('offline'));
  send();expect(await result).toMatchObject({cached:'route'});
  expect(sw.fetch).toHaveBeenCalledTimes(1);
});
it('still loads a route when the cache quota is exhausted', async () => {
  const sw=worker();const response={ok:true,headers:new Headers({'Content-Type':'text/javascript'}),clone:()=>({})};
  sw.fetch.mockResolvedValue(response);sw.cache.put.mockRejectedValue(new Error('quota'));
  let result!:Promise<unknown>;
  sw.handlers.fetch({request:{method:'GET',url:'https://example.com/assets/chat.js',mode:'cors'},respondWith:(value:Promise<unknown>)=>{result=value;}});
  expect(await result).toBe(response);
});

it.each(['chat.js', 'chat.css'])('never caches an HTML fallback for %s', async file => {
  const sw=worker();
  const response={ok:true,headers:new Headers({'Content-Type':'text/html; charset=utf-8'}),clone:()=>({html:true})};
  sw.fetch.mockResolvedValue(response);
  let result!:Promise<unknown>;
  sw.handlers.fetch({request:{method:'GET',url:`https://example.com/assets/${file}`,mode:'cors'},respondWith:(value:Promise<unknown>)=>{result=value;}});
  await result;
  expect(sw.cache.put).not.toHaveBeenCalled();
});

it('discards a previously cached HTML fallback and fetches valid JavaScript', async () => {
  const sw=worker();
  sw.caches.keys.mockResolvedValue(['papos-app-assets-old']);
  sw.cache.match.mockResolvedValue({ok:true,headers:new Headers({'Content-Type':'text/html'})});
  const response={ok:true,headers:new Headers({'Content-Type':'application/javascript'}),clone:()=>({js:true})};
  sw.fetch.mockResolvedValue(response);
  const request={method:'GET',url:'https://example.com/assets/chat.js',mode:'cors'};
  let result!:Promise<unknown>;
  sw.handlers.fetch({request,respondWith:(value:Promise<unknown>)=>{result=value;}});
  expect(await result).toBe(response);
  expect(sw.cache.delete).toHaveBeenCalledWith(request);
  expect(sw.cache.put).toHaveBeenCalledWith(request,{js:true});
});
