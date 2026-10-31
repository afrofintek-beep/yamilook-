import { it, expect, vi } from 'vitest';
import { Blob } from 'node:buffer';
import { webcrypto } from 'node:crypto';
vi.stubGlobal('crypto',webcrypto);
import { prepareObject } from '../../supabase/functions/migrate-chat-attachments/prepare';
function fixture() {
 const objects=new Map<string,Blob>([['media/u/file',new Blob(['original'])]]);
 let row:any=null, failManifest=false, corrupt=false;
 const job={bucket:'media',path:'u/file',conversation:'c',uploader:'u',refs:[{table:'messages',id:'m',column:'media_url',value:'old-url'}]};
 const admin={storage:{from:(bucket:string)=>({
  download:async(path:string)=>({data:objects.get(`${bucket}/${path}`),error:objects.has(`${bucket}/${path}`)?null:new Error('missing')}),
  copy:async(path:string,dest:string)=>{const key=`chat-attachments/${dest}`;if(objects.has(key))return {error:new Error('exists')};objects.set(key,corrupt?new Blob(['bad']):objects.get(`${bucket}/${path}`)!);return {error:null};},
 })},from:()=>({
  select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})}),
  insert:(data:any)=>({select:()=>({single:async()=>{row=data;return {data:row,error:null};}})}),
  update:(data:any)=>{const q:any={eq:()=>q,is:()=>q,select:()=>q,maybeSingle:async()=>{if(failManifest)return {error:new Error('interrupted')};row={...row,...data};return {data:{id:row.id},error:null};}};return q;},
 })};
 return {admin,job,objects,row:()=>row,interrupt:()=>{failManifest=true},resume:()=>{failManifest=false},corrupt:()=>{corrupt=true}};
}
it('verifies two private copies and preserves the original and exact reference manifest',async()=>{
 const f=fixture();expect(await prepareObject(f.admin,f.job)).toEqual({prepared:1,original_retained:true,references_changed:0});
 expect(await f.objects.get('media/u/file')!.text()).toBe('original');expect(f.objects.size).toBe(3);
 expect(f.row().legacy_manifest.references).toEqual(f.job.refs);expect(f.row().legacy_manifest.sha256).toHaveLength(64);
});
it('resumes after manifest failure without losing destinations or overwriting copies',async()=>{
 const f=fixture();f.interrupt();await expect(prepareObject(f.admin,f.job)).rejects.toThrow('Manifest');
 const id=f.row().id;f.resume();await prepareObject(f.admin,f.job);expect(f.row().id).toBe(id);expect(f.objects.size).toBe(3);
});
it('rejects corrupted copies and preserves the original',async()=>{
 const f=fixture();f.corrupt();await expect(prepareObject(f.admin,f.job)).rejects.toThrow('verification');
 expect(f.row().legacy_manifest).toBeUndefined();expect(await f.objects.get('media/u/file')!.text()).toBe('original');
});
it('stops on a missing original instead of claiming success',async()=>{
 const f=fixture();f.objects.clear();await expect(prepareObject(f.admin,f.job)).rejects.toThrow('unavailable');expect(f.row().legacy_manifest).toBeUndefined();
});
it('detects changed source on retry without overwriting verified private copies',async()=>{
 const f=fixture();await prepareObject(f.admin,f.job);f.objects.set('media/u/file',new Blob(['changed']));
 await expect(prepareObject(f.admin,f.job)).rejects.toThrow('verification');
 expect(await f.objects.get(`chat-attachments/${f.row().object_path}`)!.text()).toBe('original');
});

it('cannot overwrite a manifest after references have been cut over',async()=>{const f=fixture();await prepareObject(f.admin,f.job);f.row().legacy_manifest.state='references_private';await expect(prepareObject(f.admin,f.job)).rejects.toThrow('Rollback references');});
