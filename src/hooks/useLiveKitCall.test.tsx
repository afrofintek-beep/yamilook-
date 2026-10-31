import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLiveKitCall } from './useLiveKitCall';
import { canJoinCall } from '../../supabase/functions/generate-livekit-token/call-access';
import { deferCallUpdate } from '@/lib/call-update-guard';
vi.mock('@/lib/direct-call-reconciliation', () => ({ reconcileDirectCalls: vi.fn().mockResolvedValue(undefined) }));
const m = vi.hoisted(() => ({ update: vi.fn(), capture: vi.fn(), micStop: vi.fn(), media: vi.fn(), rpc: vi.fn(), invoke: vi.fn(), create: vi.fn(), end: vi.fn(), stop: vi.fn(), rooms: [] as any[], release: undefined as undefined | (() => void) }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, profile: { display_name: 'Me' } }) }));
vi.mock('./webrtc/useCallLifecycle', () => ({ useCallLifecycle: () => ({ createCallInDB: m.create, endCallInDB: m.end, clearRingTimeout: vi.fn(), updateMediaStatus: m.media, updateParticipantStatus: vi.fn(), updateCallStatus: vi.fn(), raiseHand: vi.fn(), sendReaction: vi.fn() }) }));
vi.mock('./webrtc/call-termination', () => ({ watchCallTermination: ({ onEnded }: any) => { m.release = onEnded; return vi.fn(); } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/virtualBackground', () => ({ DEFAULT_EFFECTS: {}, effectsActive: () => false, VirtualBackgroundProcessor: {} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: m.rpc, functions: { invoke: m.invoke }, from: () => { const q: any = { update: (value: any) => { m.update(value); return q; }, eq: () => q, in: () => q, select: () => q, maybeSingle: () => Promise.resolve({ data: { id: 'call-id' }, error: null }), then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) }; return q; } } }));
vi.mock('livekit-client', () => ({
  Track: { Source: { Camera: 'camera', Microphone: 'microphone', ScreenShare: 'screen' } },
  ConnectionState: { Connected: 'connected' },
  RoomEvent: Object.fromEntries(['TrackSubscribed','TrackUnsubscribed','TrackMuted','TrackUnmuted','LocalTrackPublished','LocalTrackUnpublished','ParticipantConnected','ParticipantDisconnected','Reconnecting','Reconnected','Disconnected'].map(x => [x,x])),
  Room: class {
    listeners = new Map(); state = 'connected'; remoteParticipants = new Map();
    localParticipant = { trackPublications: new Map([['mic', { track: { mediaStreamTrack: { kind: 'audio' }, stop: m.stop } }]]), isMicrophoneEnabled: true, isCameraEnabled: false, isScreenShareEnabled: false, getTrackPublication: () => undefined, publishTrack: vi.fn().mockResolvedValue({}), setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {this.localParticipant.isMicrophoneEnabled = enabled;}), setCameraEnabled: vi.fn(async (enabled: boolean) => {this.localParticipant.isCameraEnabled = enabled;}), setScreenShareEnabled: vi.fn(async (enabled: boolean) => {this.localParticipant.isScreenShareEnabled = enabled;}) };
    connect = vi.fn().mockResolvedValue(undefined); disconnect = vi.fn().mockResolvedValue(undefined); startAudio = vi.fn();
    constructor() { m.rooms.push(this); }
    on(event: string, callback: any) { this.listeners.set(event, callback); return this; }
    removeAllListeners() { this.listeners.clear(); }
    emit(event: string) { this.listeners.get(event)?.(); }
  },
}));
beforeEach(() => {
  vi.clearAllMocks(); m.rooms.length = 0; m.release = undefined;
  m.invoke.mockResolvedValue({ data: { token: 'token', url: 'wss://test' }, error: null });
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.create.mockResolvedValue('call-id'); m.end.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: m.capture } });
  m.capture.mockResolvedValue({ getAudioTracks: () => [{ kind: 'audio', readyState: 'live', stop: m.micStop }], getTracks: () => [{ kind: 'audio', stop: m.micStop }] });
  vi.stubGlobal('MediaStream', class { constructor(public tracks: any[]) {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('does not report a room with only the caller as a connected call', async () => {
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice', 'chat'); });
  expect(result.current.state.callStatus).toBe('ringing');
  expect(m.invoke).toHaveBeenCalledWith('generate-livekit-token', expect.objectContaining({ body: expect.objectContaining({ roomName: 'call-call-id' }) }));
  const room = m.rooms[0];
  room.remoteParticipants.set('other', { identity: 'other', trackPublications: new Map([['audio', { isSubscribed: true, track: { mediaStreamTrack: { kind: 'audio' } } }]]) });
  act(() => room.emit('TrackSubscribed'));
  expect(result.current.state.callStatus).toBe('connected');
  act(() => room.emit('Reconnecting'));
  expect(result.current.state.callStatus).toBe('connecting');
  act(() => room.emit('Reconnected'));
  expect(result.current.state.callStatus).toBe('connected');
});
it('stops the microphone immediately even when remote persistence hangs', async () => {
  m.rpc.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  act(() => { void result.current.endCall(); });
  expect(m.stop).toHaveBeenCalled(); expect(m.rooms[0].disconnect).toHaveBeenCalled();
  expect(result.current.state.callStatus).toBe('ended');
});
it('releases the prepared microphone when server authorization fails', async () => {
  m.invoke.mockResolvedValue({ data: null, error: new Error('403') });
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await expect(result.current.initiateCall('other', 'video')).rejects.toThrow('acesso seguro'); });
  expect(m.rooms).toHaveLength(0); expect(m.micStop).toHaveBeenCalled(); expect(result.current.state.callStatus).toBe('failed');
});
it('cancels an in-flight token request without reopening devices', async () => {
  let resolve!: (v: any) => void;
  m.invoke.mockReturnValue(new Promise(r => { resolve = r; }));
  const { result } = renderHook(useLiveKitCall);
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.initiateCall('other', 'voice').catch(e => e); });
  await waitFor(() => expect(m.invoke).toHaveBeenCalled());
  await act(async () => { await result.current.endCall(); resolve({ data: { token: 'late', url: 'wss://late' } }); await pending; });
  expect(m.rooms).toHaveLength(0); expect(result.current.state.callStatus).toBe('ended');
});
it('releases local devices when the remote authoritative row is ended', async () => {
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.answerCall('call-id', 'voice', 'other'); });
  act(() => (m.release as any)?.({ status: 'ended', end_reason: 'completed' }));
  expect(m.stop).toHaveBeenCalled(); expect(result.current.state.callStatus).toBe('ended');
});
it('rejects overlapping calls and self calls', async () => {
  const { result } = renderHook(useLiveKitCall);
  await expect(result.current.initiateCall('me', 'voice')).rejects.toThrow('outro contacto');
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  await expect(result.current.initiateCall('third', 'voice')).rejects.toThrow('em curso');
  expect(m.rooms).toHaveLength(1);
});
it('authorizes only active, directly invited call members', () => {
  const call = { initiator_id: 'caller', caller_id: 'caller', callee_id: 'callee', status: 'ringing' };
  expect(canJoinCall('callee', call, { status: 'ringing' })).toBe(true);
  expect(canJoinCall('intruder', call, { status: 'connected' })).toBe(false);
  for (const status of ['ended','failed','declined','missed']) expect(canJoinCall('callee', { ...call, status }, { status: 'connected' })).toBe(false);
  expect(canJoinCall('callee', call, null)).toBe(false);
  expect(canJoinCall('callee', call, { status: 'left' })).toBe(false);
});
it('publishes microphone and camera for video calls', async () => {
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'video'); });
  expect(m.rooms[0].localParticipant.publishTrack).toHaveBeenCalledWith(expect.objectContaining({ kind: 'audio' }), { source: 'microphone' });
  expect(m.rooms[0].localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
  expect(result.current.state.callStatus).not.toBe('failed');
});
it('terminates an unanswered call at the establishment deadline', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(result.current.state.callStatus).toBe('ended'); expect(result.current.state.lastError).toBe('Sem resposta.'); expect(m.stop).toHaveBeenCalled();
});
it('gives a temporarily absent remote participant time to reconnect', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  const room = m.rooms[0];
  room.remoteParticipants.set('other', { identity: 'other', trackPublications: new Map([['audio', { isSubscribed: true, track: { mediaStreamTrack: { kind: 'audio' } } }]]) });
  act(() => room.emit('TrackSubscribed'));
  room.remoteParticipants.clear(); act(() => room.emit('ParticipantDisconnected'));
  act(() => vi.advanceTimersByTime(20_000));
  expect(result.current.state.callStatus).toBe('connecting'); expect(m.stop).not.toHaveBeenCalled();
  room.remoteParticipants.set('other', { identity: 'other', trackPublications: new Map([['audio', { isSubscribed: true, track: { mediaStreamTrack: { kind: 'audio' } } }]]) });
  act(() => room.emit('TrackSubscribed'));
  act(() => vi.advanceTimersByTime(60_000));
  expect(result.current.state.callStatus).toBe('connected'); expect(m.stop).not.toHaveBeenCalled();
});
it('releases hardware on unmount', async () => {
  const { result, unmount } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  unmount(); expect(m.stop).toHaveBeenCalled(); expect(m.rooms[0].disconnect).toHaveBeenCalled();
  expect(m.rpc).toHaveBeenCalledWith('finish_direct_call',{p_call_id:'call-id',p_outcome:'completed'});
});

it('bounds the media wait when the server reports an answered call without remote tracks', async () => {
  vi.useFakeTimers(); m.rpc.mockResolvedValue({data:false,error:null});
  const {result}=renderHook(useLiveKitCall);
  await act(async()=>{await result.current.initiateCall('other','voice');});
  await act(async()=>{vi.advanceTimersByTime(60_000);});
  expect(result.current.state.callStatus).toBe('connecting');
  act(()=>vi.advanceTimersByTime(30_000));
  expect(result.current.state.callStatus).toBe('failed');
  expect(result.current.state.lastError).toContain('receber áudio ou vídeo');
  expect(m.stop).toHaveBeenCalled();
});

it('defers destructive updates while microphone permission is pending', async()=>{
  vi.useFakeTimers();
  let allow!: (value: unknown)=>void;
  m.capture.mockReturnValue(new Promise(resolve=>{allow=resolve;}));
  const {result}=renderHook(useLiveKitCall);
  let pending!:Promise<unknown>;
  act(()=>{pending=result.current.initiateCall('other','voice').catch(e=>e);});
  const update=vi.fn();deferCallUpdate(update);expect(update).not.toHaveBeenCalled();
  await act(async()=>{await result.current.endCall();allow({getTracks:()=>[{stop:m.micStop}]});await pending;vi.runOnlyPendingTimers();});
  expect(update).toHaveBeenCalledOnce();expect(m.create).not.toHaveBeenCalled();
});

it('reports server busy without requesting a token or opening media', async () => {
  m.create.mockRejectedValue({ message: 'callee_busy' });
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await expect(result.current.initiateCall('other', 'voice')).rejects.toMatchObject({message:'callee_busy'}); });
  expect(m.invoke).not.toHaveBeenCalled(); expect(m.rooms).toHaveLength(0);
});
it('does not connect a second answering device or end the first device call', async () => {
  m.rpc.mockResolvedValue({ data: false, error: null });
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await expect(result.current.answerCall('call-id','voice','other')).rejects.toThrow('noutro dispositivo'); });
  expect(m.invoke).not.toHaveBeenCalled(); expect(m.rooms).toHaveLength(0);
  expect(m.rpc).toHaveBeenCalledTimes(1);
});
it('releases a late accepted claim after local cancellation', async () => {
  let resolve!: (v: any) => void;
  m.rpc.mockImplementationOnce(() => new Promise(r=>{resolve=r;}));
  const { result } = renderHook(useLiveKitCall);
  let answer!: Promise<void>;
  act(()=>{answer=result.current.answerCall('call-id','voice','other');});
  await act(async()=>{await result.current.endCall();resolve({data:true});await answer;});
  expect(m.invoke).not.toHaveBeenCalled();
  expect(m.rpc).toHaveBeenLastCalledWith('finish_direct_call',{p_call_id:'call-id',p_outcome:'completed'});
});

it('mute, camera and screen-sharing controls update local media and participant state', async () => {
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  await act(async () => { await result.current.toggleMute(); });
  expect(result.current.state.isMuted).toBe(true);
  expect(m.media).toHaveBeenLastCalledWith('call-id','me',true);
  await act(async () => { await result.current.toggleVideo(); });
  expect(result.current.state.isVideoEnabled).toBe(true);
  await act(async () => { await result.current.toggleScreenShare(); });
  expect(result.current.state.isScreenSharing).toBe(true);
  expect(m.media).toHaveBeenLastCalledWith('call-id','me',undefined,undefined,true);
});

it('keeps voice working if camera permission is denied', async () => {
  // Deny only the camera operation for the next constructed room.
  m.invoke.mockImplementationOnce(async () => ({data:{token:'token',url:'wss://test'},error:null}));
  const { result }=renderHook(useLiveKitCall);
  await act(async()=>{await result.current.initiateCall('other','voice');});
  m.rooms[0].localParticipant.setCameraEnabled.mockRejectedValue(new DOMException('denied','NotAllowedError'));
  await act(async()=>{await result.current.toggleVideo();});
  expect(result.current.state.callStatus).toBe('ringing');
  expect(m.rooms[0].localParticipant.isMicrophoneEnabled).toBe(true);
});

it('preserves remote rejection after releasing media so the caller receives rejection feedback', async () => {
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  act(() => (m.release as any)?.({ status: 'declined', end_reason: 'declined' }));
  expect(m.stop).toHaveBeenCalled();
  expect(result.current.state.callId).toBeNull();
  expect(result.current.state.callStatus).toBe('declined');
  expect(result.current.state.lastError).toBe('Chamada recusada.');
});

it('waits for microphone permission before creating or announcing an outgoing call', async () => {
  let allow!: (stream: any) => void;
  m.capture.mockReturnValue(new Promise(resolve => { allow = resolve; }));
  const { result } = renderHook(useLiveKitCall);
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.initiateCall('other', 'voice'); });
  expect(m.capture).toHaveBeenCalledOnce();
  expect(m.create).not.toHaveBeenCalled(); expect(m.invoke).not.toHaveBeenCalled();
  expect(result.current.state.callStatus).toBe('initiating');
  const track = { kind: 'audio', readyState: 'live', stop: m.micStop };
  await act(async () => { allow({ getAudioTracks: () => [track], getTracks: () => [track] }); await pending; });
  expect(m.create).toHaveBeenCalledOnce();
  expect(m.rooms[0].localParticipant.publishTrack).toHaveBeenCalledWith(track, { source: 'microphone' });
  expect(m.rooms[0].localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
  expect(m.capture).toHaveBeenCalledOnce();
});
it('does not notify the recipient when microphone permission is denied', async () => {
  m.capture.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await expect(result.current.initiateCall('other', 'voice')).rejects.toThrow('denied'); });
  expect(m.create).not.toHaveBeenCalled(); expect(m.invoke).not.toHaveBeenCalled();
  expect(result.current.state.lastError).toContain('microfone não foi autorizado');
});
it('stops a microphone granted after setup was cancelled without notifying the recipient', async () => {
  let allow!: (stream: any) => void;
  m.capture.mockReturnValue(new Promise(resolve => { allow = resolve; }));
  const { result } = renderHook(useLiveKitCall);
  let pending!: Promise<unknown>;
  act(() => { pending = result.current.initiateCall('other', 'voice').catch(e => e); });
  await act(async () => { await result.current.endCall(); });
  await act(async () => { allow({ getTracks: () => [{ stop: m.micStop }] }); await pending; });
  expect(m.micStop).toHaveBeenCalled(); expect(m.create).not.toHaveBeenCalled();
  expect(m.rooms).toHaveLength(0);
});
it('records the failing transport stage without recording an error message', async () => {
  m.invoke.mockResolvedValue({ data: { token: 'token', url: 'wss://test' } });
  m.capture.mockRejectedValue(new DOMException('private device name', 'NotReadableError'));
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await expect(result.current.answerCall('call-id', 'voice', 'other')).rejects.toThrow(); });
  expect(result.current.state.lastError).toContain('Não foi possível abrir o microfone');
  expect(m.invoke).not.toHaveBeenCalled();
  expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ end_reason: 'transport_failed:microphone:NotReadableError' }));
});
