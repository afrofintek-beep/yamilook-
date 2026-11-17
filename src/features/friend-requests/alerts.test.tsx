import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {FriendRequestAlerts,FriendNotificationBell} from './alerts';
const m=vi.hoisted(()=>({user:{id:'me'} as {id:string}|null,rows:[] as {id:string;updated_at:string}[],callback:()=>{},navigate:vi.fn(),toast:Object.assign(vi.fn(),{dismiss:vi.fn()})}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:m.user})}));
vi.mock('@/hooks/useSettings',()=>({useSettings:()=>({settings:{notifications_enabled:true}})}));
vi.mock('react-router-dom',()=>({useNavigate:()=>m.navigate,useLocation:()=>({pathname:'/feed'})}));
vi.mock('sonner',()=>({toast:m.toast}));
vi.mock('@/i18n/ui-copy',()=>({useUiLocale:()=>{},uiText:(text:string,params?:{count:number})=>text.replace('{{count}}',String(params?.count))}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{from:()=>{
 const q:Record<string,(...a:unknown[])=>unknown>={};for(const method of ['select','eq','order','limit'])q[method]=()=>q;
 q.then=(resolve:(x:unknown)=>unknown)=>Promise.resolve({data:m.rows,count:m.rows.length,error:null}).then(resolve);return q;
},channel:()=>{const c={on:(_:unknown,__:unknown,cb:()=>void)=>{m.callback=cb;return c;},subscribe:()=>c};return c;},removeChannel:vi.fn()}}));
beforeEach(()=>{m.user={id:'me'};m.rows=[];m.toast.mockClear();m.navigate.mockClear();});
afterEach(cleanup);
it('shows a pending-request badge and new arrivals without repeating alerts on refresh',async()=>{
 render(<FriendRequestAlerts><FriendNotificationBell/></FriendRequestAlerts>);
 m.rows=[{id:'one',updated_at:'today'}];await act(async()=>m.callback());
 await waitFor(()=>expect(screen.getByText('1')).toBeTruthy());expect(m.toast).toHaveBeenCalledTimes(1);
 await act(async()=>m.callback());expect(m.toast).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button'));expect(m.navigate).toHaveBeenCalledWith('/notifications');
 m.rows=[];await act(async()=>m.callback());await waitFor(()=>expect(screen.queryByText('1')).toBeNull());
});
it('clears pending counts when the account signs out',async()=>{
 m.rows=[{id:'one',updated_at:'today'}];const view=render(<FriendRequestAlerts><FriendNotificationBell/></FriendRequestAlerts>);
 await waitFor(()=>expect(screen.getByText('1')).toBeTruthy());
 m.user=null;view.rerender(<FriendRequestAlerts><FriendNotificationBell/></FriendRequestAlerts>);
 await waitFor(()=>expect(screen.queryByText('1')).toBeNull());
});
