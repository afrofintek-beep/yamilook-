import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useLiveKitCall } from './useLiveKitCall';
import { canJoinCall } from '../../supabase/functions/generate-livekit-token/call-access';
const m = vi.hoisted(() => ({ invoke: vi.fn(), create: vi.fn(), end: vi.fn(), stop: vi.fn(), rooms: [] as any[], release: undefined as undefined | (() => void) }));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'me' }, profile: { display_name: 'Me' } }) }));
vi.mock('./webrtc/useCallLifecycle', () => ({ useCallLifecycle: () => ({ createCallInDB: m.create, endCallInDB: m.end, clearRingTimeout: vi.fn(), updateParticipantStatus: vi.fn(), updateCallStatus: vi.fn(), raiseHand: vi.fn(), sendReaction: vi.fn() }) }));
vi.mock('./webrtc/call-termination', () => ({ watchCallTermination: ({ onEnded }: any) => { m.release = onEnded; return vi.fn(); } }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/virtualBackground', () => ({ DEFAULT_EFFECTS: {}, effectsActive: () => false, VirtualBackgroundProcessor: {} }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: m.invoke }, from: () => { const q: any = { update: () => q, eq: () => q, in: () => q, select: () => q, maybeSingle: () => Promise.resolve({ data: { id: 'call-id' }, error: null }), then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) }; return q; } } }));
vi.mock('livekit-client', () => ({
  Track: { Source: { Camera: 'camera', Microphone: 'microphone', ScreenShare: 'screen' } },
  ConnectionState: { Connected: 'connected' },
  RoomEvent: Object.fromEntries(['TrackSubscribed','TrackUnsubscribed','TrackMuted','TrackUnmuted','LocalTrackPublished','LocalTrackUnpublished','ParticipantConnected','ParticipantDisconnected','Reconnecting','Reconnected','Disconnected'].map(x => [x,x])),
  Room: class {
    listeners = new Map(); state = 'connected'; remoteParticipants = new Map();
    localParticipant = { trackPublications: new Map([['mic', { track: { mediaStreamTrack: { kind: 'audio' }, stop: m.stop } }]]), isMicrophoneEnabled: true, isCameraEnabled: false, isScreenShareEnabled: false, getTrackPublication: () => undefined, setMicrophoneEnabled: vi.fn().mockResolvedValue(undefined), setCameraEnabled: vi.fn().mockResolvedValue(undefined) };
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
  m.create.mockResolvedValue('call-id'); m.end.mockResolvedValue(undefined);
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
  m.end.mockReturnValue(new Promise(() => {}));
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  act(() => { void result.current.endCall(); });
  expect(m.stop).toHaveBeenCalled(); expect(m.rooms[0].disconnect).toHaveBeenCalled();
  expect(result.current.state.callStatus).toBe('ended');
});
it('does not capture media when server authorization fails', async () => {
  m.invoke.mockResolvedValue({ data: null, error: new Error('403') });
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await expect(result.current.initiateCall('other', 'video')).rejects.toThrow('acesso seguro'); });
  expect(m.rooms).toHaveLength(0); expect(result.current.state.callStatus).toBe('failed');
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
  act(() => m.release?.());
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
  expect(m.rooms[0].localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
  expect(m.rooms[0].localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
  expect(result.current.state.callStatus).not.toBe('failed');
});
it('terminates an unanswered call at the establishment deadline', async () => {
  vi.useFakeTimers();
  const { result } = renderHook(useLiveKitCall);
  await act(async () => { await result.current.initiateCall('other', 'voice'); });
  await act(async () => { vi.advanceTimersByTime(60_000); });
  expect(result.current.state.callStatus).toBe('failed'); expect(m.stop).toHaveBeenCalled();
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
});
