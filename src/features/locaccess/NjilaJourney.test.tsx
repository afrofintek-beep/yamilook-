import {act,cleanup,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const api=vi.hoisted(()=>({call:vi.fn()}));
vi.mock('./api',()=>({locaccess:api.call,validHandle:()=>true}));
import {NjilaJourney} from './NjilaJourney';
const origin='https://www.njilamaps.com',audience='00000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.useFakeTimers();api.call.mockReset();Object.defineProperty(navigator,'onLine',{configurable:true,value:true});Object.defineProperty(document,'hidden',{configurable:true,value:false})});
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
