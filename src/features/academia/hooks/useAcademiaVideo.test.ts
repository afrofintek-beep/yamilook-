import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({invoke:vi.fn(),session:vi.fn(),refresh:vi.fn(),rooms:[] as any[], denyCamera:false, failConnect:false}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:state.session,refreshSession:state.refresh},functions:{invoke:state.invoke}}}));
vi.mock('livekit-client',()=>({
  DisconnectReason:{DUPLICATE_IDENTITY:2,PARTICIPANT_REMOVED:4,ROOM_DELETED:5,2:'DUPLICATE_IDENTITY',4:'PARTICIPANT_REMOVED',5:'ROOM_DELETED'},
  ConnectionState:{Disconnected:'disconnected',Connected:'connected'},
  RoomEvent:{Disconnected:'disconnected',ConnectionStateChanged:'state',DataReceived:'data'},
  Room:class {
    remoteParticipants=new Map();canPlaybackAudio=true;handlers=new Map();
    localParticipant={isCameraEnabled:false,isMicrophoneEnabled:false,setCameraEnabled:vi.fn().mockResolvedValue(undefined),setMicrophoneEnabled:vi.fn().mockResolvedValue(undefined),publishData:vi.fn().mockResolvedValue(undefined)};
    connect=vi.fn().mockResolvedValue(undefined);disconnect=vi.fn().mockResolvedValue(undefined);startAudio=vi.fn().mockResolvedValue(undefined);
    on(e:any,cb:any){this.handlers.set(e,cb);return this;}
    constructor(public options:any){if(state.failConnect)this.connect.mockRejectedValue(new Error("Network unavailable"));if(state.denyCamera)this.localParticipant.setCameraEnabled.mockRejectedValue(new Error("NotAllowedError"));state.rooms.push(this);}
  }
}));
import { deferCallUpdate } from '@/lib/call-update-guard';
import { academiaReconnectPolicy, requestAcademiaVideo, useAcademiaVideo } from './useAcademiaVideo';
beforeEach(()=>{
  sessionStorage.clear();
  state.rooms.length=0;state.denyCamera=false;state.failConnect=false;state.invoke.mockReset();state.session.mockReset();state.refresh.mockReset();
  state.session.mockResolvedValue({data:{session:{access_token:'test-token',expires_at:Date.now()/1000+1000}}});
  state.invoke.mockResolvedValue({data:{token:'room-token',url:'wss://example.invalid'},error:null});
});
afterEach(cleanup);
describe('Academia video connection',()=>{
  it('sends the authenticated token and server action',async()=>{
    await requestAcademiaVideo('session','start');
    expect(state.invoke).toHaveBeenCalledWith('academia-video',{headers:{Authorization:'Bearer test-token'},body:{sessionId:'session',action:'start'}});
  });
  it('refreshes an expiring authentication session',async()=>{
    state.session.mockResolvedValue({data:{session:{access_token:'old',expires_at:1}}});
    state.refresh.mockResolvedValue({data:{session:{access_token:'fresh'}}});
    await requestAcademiaVideo('session','join');
    expect(state.invoke.mock.calls[0][1].headers.Authorization).toBe('Bearer fresh');
  });
  it('does not connect when the server denies access',async()=>{
    state.invoke.mockResolvedValue({error:{context:{json:async()=>({error:'reservation_required'})}}});
    const {result}=renderHook(()=>useAcademiaVideo('session'));
    await act(()=>result.current.join(false,false,false));
    expect(state.rooms).toHaveLength(0);expect(result.current.error).toContain('Reserva');
  });
  it('can join in listening mode without requesting camera or microphone',async()=>{
    const {result}=renderHook(()=>useAcademiaVideo('session'));
    await act(()=>result.current.join(false,false,false));
    expect(result.current.room).toBe(state.rooms[0]);
    expect(state.rooms[0].localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(state.rooms[0].localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  });
  it('retains the connection when camera permission is refused',async()=>{
    const {result}=renderHook(()=>useAcademiaVideo('session'));
    state.denyCamera=true;
    await act(()=>result.current.join(false,true,true));
    expect(result.current.room).toBe(state.rooms[0]);
    expect(result.current.error).toContain('Ligado sem');
    expect(state.rooms[0].localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
    expect(state.rooms[0].localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  });
  it('disconnects on unmount and blocks a late credential response',async()=>{
    let resolve:any;state.invoke.mockReturnValue(new Promise(r=>{resolve=r;}));
    const {result,unmount}=renderHook(()=>useAcademiaVideo('session'));
    let pending:Promise<void>;
    act(()=>{pending=result.current.join(false,true,true);});
    await waitFor(()=>expect(state.invoke).toHaveBeenCalled());
    unmount();
    await act(async()=>{resolve({data:{token:'t',url:'wss://example.invalid'}});await pending;});
    expect(state.rooms).toHaveLength(0);
  });
  it('releases the room on exit',async()=>{
    const {result}=renderHook(()=>useAcademiaVideo('session'));
    await act(()=>result.current.join(false,false,false));
    act(()=>result.current.leave());
    expect(state.rooms[0].disconnect).toHaveBeenCalled();expect(result.current.room).toBeNull();
  });
});
it('keeps mentor and learner connections independent',async()=>{
  const mentor=renderHook(()=>useAcademiaVideo('session'));
  const learner=renderHook(()=>useAcademiaVideo('session'));
  await act(async()=>{await Promise.all([mentor.result.current.join(true,true,true),learner.result.current.join(false,false,false)]);});
  expect(state.rooms).toHaveLength(2);
  expect(state.invoke.mock.calls.map(c=>c[1].body.action)).toEqual(['start','join']);
  act(()=>learner.result.current.leave());
  expect(mentor.result.current.room).not.toBeNull();
  expect(state.rooms[0].disconnect).not.toHaveBeenCalled();
  expect(state.rooms[1].disconnect).toHaveBeenCalled();
});
it('disconnects on connection failure without requesting devices',async()=>{
  state.failConnect=true;
  const {result}=renderHook(()=>useAcademiaVideo('session'));
  await act(()=>result.current.join(false,true,true));
  const room=state.rooms[0];
  expect(room.disconnect).toHaveBeenCalled();
  expect(result.current.room).toBeNull();
  expect(result.current.error).toBeTruthy();
  expect(room.localParticipant.setCameraEnabled).not.toHaveBeenCalled();
});
it('refreshes and retries once when a still-valid token is revoked',async()=>{
  state.invoke.mockResolvedValueOnce({error:{context:{status:401}}}).mockResolvedValueOnce({data:{token:'t',url:'wss://example.invalid'}});
  state.refresh.mockResolvedValue({data:{session:{access_token:'renewed'}}});
  await requestAcademiaVideo('session','start');
  expect(state.refresh).toHaveBeenCalledTimes(1);
  expect(state.invoke).toHaveBeenCalledTimes(2);
  expect(state.invoke.mock.calls[1][1].headers.Authorization).toBe('Bearer renewed');
});
it('asks for login when the session cannot be recovered',async()=>{
  state.invoke.mockResolvedValue({error:{context:{status:401}}});
  state.refresh.mockResolvedValue({data:{session:null},error:{message:'Refresh Token Not Found'}});
  await expect(requestAcademiaVideo('session','join')).rejects.toThrow('Inicia sessão novamente');
  expect(state.invoke).toHaveBeenCalledTimes(1);
});
it('does not refresh authorization failures',async()=>{
  state.invoke.mockResolvedValue({error:{context:{status:403,json:async()=>({error:'too_early'})}}});
  await expect(requestAcademiaVideo('session','start')).rejects.toThrow('15 minutos');
  expect(state.refresh).not.toHaveBeenCalled();
});

it('preserves the room while the SDK reconnects and uses a bounded recovery window',async()=>{
  const {result}=renderHook(()=>useAcademiaVideo('session'));
  await act(()=>result.current.join(true,true,true));
  const room=state.rooms[0];
  act(()=>room.handlers.get('state')('reconnecting'));
  expect(result.current.room).toBe(room);
  expect(result.current.connection).toBe('reconnecting');
  expect(room.disconnect).not.toHaveBeenCalled();
  expect(room.options.reconnectPolicy).toBe(academiaReconnectPolicy);
  expect(academiaReconnectPolicy.nextRetryDelayInMs({elapsedMs:60000,retryCount:5})).toBe(5000);
  expect(academiaReconnectPolicy.nextRetryDelayInMs({elapsedMs:120000})).toBeNull();
  act(()=>room.handlers.get('state')('connected'));
  expect(result.current.room).toBe(room);
});
it.each([2,4,5])('records definitive disconnect %s without automatically reopening the room',async(reason)=>{
  const {result}=renderHook(()=>useAcademiaVideo('session'));
  await act(()=>result.current.join(true,false,false));
  act(()=>state.rooms[0].handlers.get('disconnected')(reason));
  expect(result.current.room).toBeNull();
  expect(result.current.connection).toBe('disconnected');
  expect(result.current.error).toBeTruthy();
  expect(state.invoke).toHaveBeenCalledTimes(1);
  const events=JSON.parse(sessionStorage.getItem('academia-call-diagnostics-v1')!);
  expect(events.at(-1).event).toBe('disconnected');
  expect(events.at(-1).detail).not.toBe('unknown');
  expect(JSON.stringify(events)).not.toContain('test-token');
});

it('holds pending updates through reconnection and releases them on leaving',async()=>{
  const {result}=renderHook(()=>useAcademiaVideo('session'));
  await act(()=>result.current.join(true,false,false));
  const update=vi.fn();deferCallUpdate(update);
  act(()=>state.rooms[0].handlers.get('state')('reconnecting'));
  expect(update).not.toHaveBeenCalled();
  act(()=>result.current.leave());
  await waitFor(()=>expect(update).toHaveBeenCalledOnce());
});
it('does not apply late room events after a definitive disconnect',async()=>{
  const {result}=renderHook(()=>useAcademiaVideo('session'));
  await act(()=>result.current.join(true,false,false));
  act(()=>state.rooms[0].handlers.get('disconnected')(2));
  act(()=>state.rooms[0].handlers.get('state')('connected'));
  expect(result.current.connection).toBe('disconnected');
  expect(result.current.room).toBeNull();
});
