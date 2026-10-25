import { runInNewContext } from 'node:vm';
import { it, expect, vi } from 'vitest';
import { callPushWorker } from '../../build/call-push-worker';
function setup(windows: unknown[] = []) {
  const handlers:Record<string,(event:unknown)=>void>={};
  const showNotification=vi.fn().mockResolvedValue(undefined),openWindow=vi.fn();
  runInNewContext(callPushWorker,{URL,Date,Number,self:{location:{origin:'https://kosolola.com'},addEventListener:(type:string,fn:(event:unknown)=>void)=>{handlers[type]=fn;},registration:{showNotification},clients:{matchAll:async()=>windows,openWindow}}});
  return {handlers,showNotification,openWindow};
}
const callId='11111111-1111-4111-8111-111111111111';
it('shows a generic, deduplicated incoming alert',async()=>{
  const s=setup();let job!:Promise<void>;
  s.handlers.push({data:{json:()=>({type:'incoming-call',callId,expiresAt:Date.now()+30000,caller:'Private name'})},waitUntil:(p:Promise<void>)=>job=p});await job;
  expect(s.showNotification).toHaveBeenCalledWith('KOSOLOLA',expect.objectContaining({tag:'call-'+callId,body:'Chamada recebida. Toca para abrir a KOSOLOLA.'}));
  expect(JSON.stringify(s.showNotification.mock.calls)).not.toContain('Private name');
});
it('does not present an expired alert as a ringing call',async()=>{
  const s=setup();let job!:Promise<void>;s.handlers.push({data:{json:()=>({type:'incoming-call',callId,expiresAt:1})},waitUntil:(p:Promise<void>)=>job=p});await job;
  expect(s.showNotification.mock.calls[0][1].body).toContain('Recebeste uma chamada');
});
it('ignores malformed payloads',async()=>{
  const s=setup();let job!:Promise<void>;s.handlers.push({data:{json:()=>{throw Error();}},waitUntil:(p:Promise<void>)=>job=p});await job;expect(s.showNotification).not.toHaveBeenCalled();
});
it('opens only the app, never a URL supplied by the payload',async()=>{
  const s=setup();let job!:Promise<void>;s.handlers.notificationclick({notification:{close:vi.fn(),data:{url:'https://attacker.test'}},waitUntil:(p:Promise<void>)=>job=p});await job;
  expect(s.openWindow).toHaveBeenCalledWith('https://kosolola.com/papos-app/papos');
});
it('focuses an existing app without replacing an active call',async()=>{
  const app={url:'https://kosolola.com/papos-app/call/existing',focus:vi.fn(),postMessage:vi.fn()};const s=setup([app]);let job!:Promise<void>;
  s.handlers.notificationclick({notification:{close:vi.fn()},waitUntil:(p:Promise<void>)=>job=p});await job;
  expect(app.focus).toHaveBeenCalled();expect(app.postMessage).toHaveBeenCalledWith({type:'kosolola:incoming-call'});expect(s.openWindow).not.toHaveBeenCalled();
});
