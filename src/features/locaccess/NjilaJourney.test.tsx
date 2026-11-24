import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('./api',()=>({locaccess:api.call,validHandle:()=>true}));
import {NjilaJourney} from './NjilaJourney';
const origin='https://www.njilamaps.com',audience='00000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.useFakeTimers({toFake:['Date','performance','setTimeout','clearTimeout','setInterval','clearInterval']});api.call.mockReset();Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(document,'hidden',{configurable:true,value:false})});
afterEach(()=>{cleanup();vi.useRealTimers()});
async function show(){
 render(<NjilaJourney handle="test"/>);
 const frame=screen.getByTitle('NJILA') as HTMLIFrameElement;
 const post=vi.spyOn(frame.contentWindow!,'postMessage');
 const send=async(data:unknown,from=origin,source:Window=frame.contentWindow!)=>act(async()=>{window.dispatchEvent(new MessageEvent('message',{origin:from,source,data}))});
 return {frame,post,send};
}
it('authorises in the parent and clears on revocation without passing account credentials',async()=>{
 api.call.mockResolvedValueOnce({status:'ready',point:{lat:-8,lon:13},expiresAt:new Date(Date.now()+20000).toISOString()}).mockResolvedValue({status:'denied'});
 const {send,post,frame}=await show();
 expect(frame.src).not.toContain('test');expect(frame.getAttribute('referrerpolicy')).toBe('origin');
 await send({type:'locaccess-ready',audience},'https://evil.invalid');expect(api.call).not.toHaveBeenCalled();
 await send({type:'locaccess-ready',audience});expect(api.call).toHaveBeenCalledWith('visit',{handle:'test'});
 expect(post).toHaveBeenCalledWith(expect.objectContaining({type:'locaccess-lease',precision:'exact',audience}),origin);
 await act(async()=>vi.advanceTimersByTimeAsync(5000));expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});
it('forwards device accuracy and time for server proximity checks; renews the area before exact disclosure',async()=>{
 api.call.mockResolvedValue({status:'proximity',radius:250,area:{lat:-8,lon:13}});
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 expect(post.mock.lastCall?.[0]).toMatchObject({type:'locaccess-lease',precision:'area'});
 const position={lat:-8,lon:13,accuracy:10,timestamp:Date.now()};
 await send({type:'locaccess-position',audience,position});
 expect(api.call).toHaveBeenLastCalledWith('visit',{handle:'test',position});
});
it('expires locally when renewal hangs and ignores a late response after going offline',async()=>{
 let finish:(v:unknown)=>void=()=>{};
 api.call.mockResolvedValueOnce({status:'ready',point:{lat:-8,lon:13},expiresAt:new Date(Date.now()+20000).toISOString()}).mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(20001));
 expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
 await act(async()=>{window.dispatchEvent(new Event('offline'));finish({status:'ready',point:{lat:-8,lon:13},expiresAt:new Date(Date.now()+20000).toISOString()})});
 expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

const issued=(extra:Record<string,unknown>={})=>({status:'ready',point:{lat:-8,lon:13},expiresAt:new Date(Date.now()+20000).toISOString(),...extra});
const disconnected=async()=>act(async()=>{
 Object.defineProperty(navigator,'onLine',{configurable:true,value:false});window.dispatchEvent(new Event('offline'));
});
const lastLease=(post:{mock:{calls:unknown[][]}})=>post.mock.calls.map(call=>call[0] as Record<string,unknown>).filter(value=>value.type==='locaccess-lease').at(-1);

it.each([undefined,'forbidden',true,'true','PERMITTED'])('clears offline unless the issuer explicitly permits it (%s)',async offlineContinuation=>{
 api.call.mockResolvedValue(issued({offlineContinuation}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 expect(lastLease(post)).toMatchObject({offlineContinuation:'forbidden'});
 await disconnected();expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('preserves only the remainder of a permitted lease in memory without renewing offline',async()=>{
 const response=issued({offlineContinuation:'permitted'});
 api.call.mockResolvedValue(response);
 const {send,post}=await show();
 const writes=vi.spyOn(Storage.prototype,'setItem');
 const localWrites=vi.mocked(localStorage.setItem);localWrites.mockClear();
 try{
  await send({type:'locaccess-ready',audience});
  expect(lastLease(post)).toMatchObject({offlineContinuation:'permitted',expiresAt:response.expiresAt});
  await act(async()=>vi.advanceTimersByTimeAsync(2000));
  const sent=post.mock.calls.length;
  await disconnected();expect(post.mock.calls).toHaveLength(sent);
  expect(screen.getByRole('status')).toHaveTextContent('não será renovado');
  await act(async()=>vi.advanceTimersByTimeAsync(17999));
  expect(post.mock.calls).toHaveLength(sent);expect(api.call).toHaveBeenCalledOnce();
  await act(async()=>vi.advanceTimersByTimeAsync(1));
  expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
  expect(screen.getByRole('status')).toHaveTextContent('A autorização terminou');
  expect(writes).not.toHaveBeenCalled();
  expect(localWrites).not.toHaveBeenCalled();
 }finally{writes.mockRestore();}
});

it('does not accept offline area permission without an authoritative expiry',async()=>{
 api.call.mockResolvedValue({status:'proximity',area:{lat:-8,lon:13},radius:250,offlineContinuation:'permitted'});
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 expect(lastLease(post)).toBeUndefined();expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('does not increase precision from a positive response that arrives after connectivity is lost',async()=>{
 let finish!:(value:unknown)=>void;
 api.call.mockResolvedValueOnce(issued({status:'proximity',point:undefined,area:{lat:-8,lon:13},radius:250,offlineContinuation:'permitted'}))
  .mockImplementation(()=>new Promise(resolve=>{finish=resolve}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(5000));await disconnected();
 const sent=post.mock.calls.length;
 await act(async()=>finish(issued({offlineContinuation:'permitted'})));
 expect(post.mock.calls).toHaveLength(sent);expect(lastLease(post)).toMatchObject({precision:'area'});
 await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it.each(['denied','auth-error','permission-removed'])('clears a permitted lease when an authoritative %s arrives while offline',async outcome=>{
 let finish!:(value:unknown)=>void,reject!:(error:unknown)=>void;
 api.call.mockResolvedValueOnce(issued({offlineContinuation:'permitted'}))
  .mockImplementation(()=>new Promise((resolve,fail)=>{finish=resolve;reject=fail}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(5000));await disconnected();
 await act(async()=>{
  if(outcome==='auth-error')reject(Object.assign(new Error('Sign in'),{code:'42501'}));
  else finish(outcome==='denied'?{status:'denied'}:issued({offlineContinuation:'forbidden'}));
 });
 expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('tolerates only a transport failure offline while the original permitted lease remains valid',async()=>{
 let fail!:(error:unknown)=>void;
 api.call.mockResolvedValueOnce(issued({offlineContinuation:'permitted'})).mockImplementation(()=>new Promise((_,reject)=>{fail=reject}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(5000));await disconnected();
 const sent=post.mock.calls.length;
 await act(async()=>fail(new TypeError('Failed to fetch')));
 expect(post.mock.calls).toHaveLength(sent);
 await act(async()=>vi.advanceTimersByTimeAsync(15000));expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it.each(['visibilitychange','pagehide','unmount'])('clears permitted offline access on %s',async event=>{
 api.call.mockResolvedValue(issued({offlineContinuation:'permitted'}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});await disconnected();
 await act(async()=>{
  if(event==='unmount')cleanup();
  else if(event==='visibilitychange'){
   Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event(event));
  }else window.dispatchEvent(new Event(event));
 });
 expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('counts delayed responses against the original twenty-second maximum',async()=>{
 let finish!:(value:unknown)=>void;
 api.call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockImplementation(()=>new Promise(()=>{}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(10000));
 await act(async()=>finish(issued({offlineContinuation:'permitted',expiresAt:new Date(Date.now()+25000).toISOString()})));
 expect(lastLease(post)).toMatchObject({offlineContinuation:'permitted'});await disconnected();
 await act(async()=>vi.advanceTimersByTimeAsync(9999));expect(post.mock.lastCall?.[0]).toMatchObject({type:'locaccess-lease'});
 await act(async()=>vi.advanceTimersByTimeAsync(1));expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('never extends or revives the same expiry when the wall clock moves backwards',async()=>{
 const response=issued({offlineContinuation:'permitted'}),start=Date.now();
 api.call.mockResolvedValue(response);
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(10000));
 vi.setSystemTime(start+5000);
 await send({type:'locaccess-position',audience,position:{lat:-8,lon:13,accuracy:5,timestamp:Date.now()}});
 await act(async()=>vi.advanceTimersByTimeAsync(10000));
 expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
 await send({type:'locaccess-ready',audience});
 expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('does not extend a short grant if the clock moves backwards while the request is pending',async()=>{
 let finish!:(value:unknown)=>void;
 const start=Date.now(),response=issued({offlineContinuation:'permitted',expiresAt:new Date(start+7000).toISOString()});
 api.call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}));
 const {send,post}=await show();await send({type:'locaccess-ready',audience});
 await act(async()=>vi.advanceTimersByTimeAsync(3000));vi.setSystemTime(start-5000);
 await act(async()=>finish(response));await disconnected();
 await act(async()=>vi.advanceTimersByTimeAsync(3999));expect(post.mock.lastCall?.[0]).toMatchObject({type:'locaccess-lease'});
 await act(async()=>vi.advanceTimersByTimeAsync(1));expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience});
});

it('ignores a stale response from an earlier audience after a new frame handshake',async()=>{
 let finish!:(value:unknown)=>void;
 api.call.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({status:'denied'});
 const {send,post,frame}=await show();
 await send({type:'locaccess-ready',audience},origin,window);expect(api.call).not.toHaveBeenCalled();
 await send({type:'locaccess-ready',audience});
 const replacement='00000000-0000-4000-8000-000000000002';
 await send({type:'locaccess-ready',audience:replacement});
 await act(async()=>finish(issued({offlineContinuation:'permitted'})));
 expect(lastLease(post)).toBeUndefined();expect(post.mock.lastCall?.[0]).toEqual({type:'locaccess-clear',audience:replacement});
 expect(frame.src).not.toContain('test');
});
