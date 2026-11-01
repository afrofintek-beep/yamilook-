import { clearListCache } from '@/lib/list-cache';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useContacts } from './useContacts';
const m=vi.hoisted(()=>({ holdContacts: false, user: {id:'me'} as {id:string}|null, reads:vi.fn(), repair:()=>new Promise<unknown>(()=>{}) }));
vi.mock('./useAuth',()=>({useAuth:()=>({user:m.user})}));
vi.mock('./usePresenceClock',()=>({usePresenceClock:()=>Date.now()}));
vi.mock('@/lib/public-profile-batch',()=>({fetchPublicProfilesBatched:vi.fn().mockResolvedValue({data:[{id:'peer',display_name:'Contacto',username:'peer'}],error:null})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{
 from:(table:string)=>{
  let status='';
  const q:Record<string,(...args:unknown[])=>unknown>={};
  for(const method of ['select','or','order','in','upsert']) q[method]=()=>q;
  q.eq=(key,value)=>{if(key==='status')status=String(value);return q;};
  q.then=(resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown)=>{
   m.reads(table,status);
   if(table==='contacts' && m.holdContacts)return new Promise(()=>{});
   if(status==='accepted')return m.repair().then(resolve,reject);
   return Promise.resolve({data:table==='contacts'?[{id:'contact',user_id:m.user?.id,contact_user_id:'peer'}]:[],error:null}).then(resolve,reject);
  };
  return q;
 },
 channel:()=>{const ch={on:()=>ch,subscribe:()=>ch};return ch;},removeChannel:vi.fn(),
}}));
beforeEach(()=>{clearListCache();m.holdContacts=false;m.user={id:'me'};m.reads.mockClear();m.repair=()=>new Promise(()=>{});});
afterEach(cleanup);
it('shows existing contacts while friendship repair is still pending',async()=>{
 const {result}=renderHook(useContacts);
 await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.contacts[0].profile?.display_name).toBe('Contacto');
 expect(m.reads).toHaveBeenCalledWith('friend_requests','accepted');
});
it('does not reload contacts or repair friendships for token refresh of the same account',async()=>{
 const {result,rerender}=renderHook(useContacts);
 await waitFor(()=>expect(result.current.loading).toBe(false));m.reads.mockClear();
 m.user={id:'me'};rerender();await act(async()=>{});
 expect(m.reads).not.toHaveBeenCalled();expect(result.current.loading).toBe(false);
});
it('a failed background repair does not hide existing contacts',async()=>{
 m.repair=()=>Promise.reject(new Error('offline'));
 const {result}=renderHook(useContacts);
 await waitFor(()=>expect(result.current.loading).toBe(false));
 expect(result.current.contacts).toHaveLength(1);
});
it('clears the list on sign out without showing an endless loader',async()=>{
 const {result,rerender}=renderHook(useContacts);
 await waitFor(()=>expect(result.current.contacts).toHaveLength(1));
 m.user=null;rerender();
 await waitFor(()=>expect(result.current.contacts).toHaveLength(0));
 expect(result.current.loading).toBe(false);
});

it('reopens saved contacts immediately while the refresh cannot finish',async()=>{
 const first=renderHook(useContacts);
 await waitFor(()=>expect(first.result.current.contacts).toHaveLength(1));
 first.unmount();m.holdContacts=true;
 const reopened=renderHook(useContacts);
 expect(reopened.result.current.loading).toBe(false);
 expect(reopened.result.current.contacts[0].profile?.display_name).toBe('Contacto');
});
