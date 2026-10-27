import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const {invoke}=vi.hoisted(()=>({invoke:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{functions:{invoke}}}));
import { disableCallPush, enableCallPush, refreshCallPush, notifyIncomingCall } from './call-push';
let subscription: {endpoint:string;unsubscribe:ReturnType<typeof vi.fn>;toJSON:()=>unknown};
let reg: {scope:string;active:object;pushManager:{getSubscription:ReturnType<typeof vi.fn>;subscribe:ReturnType<typeof vi.fn>};getNotifications:ReturnType<typeof vi.fn>};
beforeEach(()=>{
 const storage=new Map<string,string>();
 vi.stubGlobal('localStorage',{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k),clear:()=>storage.clear()});
 localStorage.clear();invoke.mockReset().mockResolvedValue({data:{ok:true},error:null});
 subscription={endpoint:'https://web.push.apple.com/test',unsubscribe:vi.fn().mockResolvedValue(true),toJSON:()=>({endpoint:'test'})};
 reg={scope:'https://kosolola.com/papos-app/',active:{},pushManager:{getSubscription:vi.fn().mockResolvedValue(null),subscribe:vi.fn().mockResolvedValue(subscription)},getNotifications:vi.fn().mockResolvedValue([])};
 vi.stubGlobal('isSecureContext',true);vi.stubGlobal('PushManager',class {});vi.stubGlobal('Notification',{permission:'granted',requestPermission:vi.fn().mockResolvedValue('granted')});
 Object.defineProperty(navigator,'serviceWorker',{value:{getRegistration:vi.fn().mockResolvedValue(reg)},configurable:true});
});
afterEach(()=>vi.unstubAllGlobals());
it('only claims enabled after saving the subscription',async()=>{
 invoke.mockResolvedValue({error:new Error('offline')});
 await expect(enableCallPush('u','AQID')).rejects.toThrow();expect(subscription.unsubscribe).toHaveBeenCalled();expect(localStorage.getItem('kosolola-push-owner')).toBeNull();
});
it('asks permission before network operations',async()=>{
 const request=vi.mocked(Notification.requestPermission);request.mockResolvedValue('denied');
 await expect(enableCallPush('u','AQID')).rejects.toThrow();expect(invoke).not.toHaveBeenCalled();expect(reg.pushManager.subscribe).not.toHaveBeenCalled();
});
it('unsubscribes locally even if the server cannot be reached',async()=>{
 reg.pushManager.getSubscription.mockResolvedValue(subscription);invoke.mockResolvedValue({error:new Error('offline')});
 await disableCallPush();expect(subscription.unsubscribe).toHaveBeenCalled();expect(invoke).toHaveBeenCalledWith('call-push',{body:{action:'remove',endpoint:subscription.endpoint}});
});
it('removes previous-account subscription instead of renewing it',async()=>{
 reg.pushManager.getSubscription.mockResolvedValue(subscription);localStorage.setItem('kosolola-push-owner','old');await refreshCallPush('new');
 expect(subscription.unsubscribe).toHaveBeenCalled();expect(invoke.mock.calls.every(([,opts])=>opts.body.action!=='subscribe')).toBe(true);
});
it('does not touch another application worker',async()=>{
 reg.scope='https://kosolola.com/';await disableCallPush();expect(reg.pushManager.getSubscription).not.toHaveBeenCalled();
});
it('push failure does not break call creation',async()=>{
 invoke.mockRejectedValue(new Error('offline'));await expect(notifyIncomingCall('id')).resolves.toBeUndefined();
});
