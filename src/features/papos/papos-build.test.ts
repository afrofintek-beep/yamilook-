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
  const cache={addAll:vi.fn().mockResolvedValue(undefined),match:vi.fn().mockResolvedValue({shell:'Papos'})};
  const caches={open:vi.fn().mockResolvedValue(cache),keys:vi.fn().mockResolvedValue([]),delete:vi.fn()};
  runInNewContext(source,{self:{location:{origin:'https://example.com'},addEventListener:(name:string,handler:(event:unknown)=>void)=>{handlers[name]=handler;},skipWaiting:vi.fn(),clients:{claim:vi.fn()}},caches,fetch,URL,Response:{error:()=>({error:true})}});
  return {source,handlers,fetch,cache,caches};
}
describe('Papos independent installation contract',()=>{
  it('has a distinct app ID, entry, scope and icons',()=>{
    const manifest=JSON.parse(readFileSync(resolve(root,'public/papos-app/manifest.webmanifest'),'utf8'));
    expect(manifest).toMatchObject({id:'/papos-app/',start_url:'/papos-app/',scope:'/papos-app/',name:'Papos'});
    for(const icon of manifest.icons){ const data=readFileSync(resolve(root,'public'+icon.src)); expect(data.readUInt32BE(16)).toBe(Number(icon.sizes.split('x')[0])); }
  });
  it('precaches messenger code, without pulling in the Yamilook entry',async()=>{
    const sw=worker(); let installed!:Promise<unknown>; sw.handlers.install({waitUntil:(promise:Promise<unknown>)=>{installed=promise;}}); await installed;
    expect(sw.cache.addAll).toHaveBeenCalledWith(expect.arrayContaining(['/papos-app/index.html','/assets/chat.js']));
    expect(sw.cache.addAll.mock.calls[0][0]).not.toContain('/assets/yamilook.js');
  });
  it('opens the Papos shell on an offline deep link',async()=>{
    const sw=worker();let response!:Promise<unknown>;sw.handlers.fetch({request:{method:'GET',url:'https://example.com/papos-app/chat/id',mode:'navigate'},respondWith:(promise:Promise<unknown>)=>{response=promise;}});
    expect(await response).toEqual({shell:'Papos'}); expect(sw.cache.match).toHaveBeenCalledWith('/papos-app/index.html');
  });
  it.each(['https://project.supabase.co/rest/v1/messages','https://project.supabase.co/storage/v1/object/sign/media/video?token=private','https://example.com/api/messages','https://example.com/muxi'])('does not intercept private requests or another application: %s',url=>{
    const sw=worker();const respondWith=vi.fn();sw.handlers.fetch({request:{method:'GET',url,mode:'cors'},respondWith});expect(respondWith).not.toHaveBeenCalled();expect(sw.fetch).not.toHaveBeenCalled();
  });
});
