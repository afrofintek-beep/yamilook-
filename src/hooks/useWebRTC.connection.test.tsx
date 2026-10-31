import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWebRTC } from './useWebRTC';
import type { UsePeerConnectionOptions } from './webrtc/usePeerConnection';
import type { useWebRTCSignaling } from './useWebRTCSignaling';

const mocks = vi.hoisted(() => {
  const stream = { getAudioTracks: () => [], getTracks: () => [] };
  const pc = { signalingState: 'stable', localDescription: { type: 'answer', sdp: 'test' },
    setRemoteDescription: vi.fn(), createAnswer: vi.fn(), setLocalDescription: vi.fn() };
  const media = { localStreamRef: { current: stream }, localStream: stream, getUserMedia: vi.fn(async () => stream), stopAllMedia: vi.fn() };
  const peer = { createPeerConnection: vi.fn(() => pc), getPeerConnection: () => pc, closeAllPeerConnections: vi.fn(), peerConnections: { current: new Map() } };
  const lifecycle = { updateParticipantStatus: vi.fn(), updateCallStatus: vi.fn(), clearRingTimeout: vi.fn() };
  const query = { eq: vi.fn(), in: vi.fn(async () => ({ error: null })) };
  query.eq.mockReturnValue(query);
  return { media, peer, pc, lifecycle, query, insert: vi.fn(async () => ({ error: null })), update: vi.fn(() => query), connection: null as unknown as UsePeerConnectionOptions, signaling: null as unknown as Parameters<typeof useWebRTCSignaling>[0] };
});
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert: mocks.insert, update: mocks.update }) } }));
vi.mock('./useICEServers', () => ({ useICEServers: () => ({ getServersForCall: async () => [{ urls: 'stun:test' }], iceServers: [] }) }));
vi.mock('./webrtc/useMediaCapture', () => ({ useMediaCapture: () => mocks.media }));
vi.mock('./webrtc/usePeerConnection', () => ({ usePeerConnection: (options: UsePeerConnectionOptions) => { mocks.connection = options; return mocks.peer; } }));
vi.mock('./webrtc/useCallLifecycle', () => ({ useCallLifecycle: () => mocks.lifecycle }));
vi.mock('./webrtc/useCallTelemetry', () => ({ useCallTelemetry: () => ({ logFinalMetrics: vi.fn(), setCallEndReason: vi.fn() }) }));
vi.mock('./webrtc/useAutoplayRecovery', () => ({ useAutoplayRecovery: () => ({ markUserInteracted: vi.fn(), tryPlayRemoteStream: vi.fn() }) }));
vi.mock('./webrtc/useICECandidateQueue', () => ({ useICECandidateQueue: () => ({ clearAllQueues: vi.fn(), applyPendingCandidates: vi.fn(), flushOutgoingCandidates: () => [] }) }));
vi.mock('./webrtc/call-termination', () => ({ watchCallTermination: () => () => {}, finishCallLocallyFirst: vi.fn() }));
vi.mock('./useWebRTCSignaling', () => ({ useWebRTCSignaling: (options: Parameters<typeof useWebRTCSignaling>[0]) => { mocks.signaling = options; return { sendAnswer: vi.fn() }; } }));
vi.mock('@/lib/virtualBackground', () => ({ DEFAULT_EFFECTS: {}, effectsActive: () => false }));
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  vi.stubGlobal('RTCSessionDescription', function(value: unknown) { return value; });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('expires an unanswered handshake without crashing React and releases the microphone', async () => {
  const { result } = renderHook(() => useWebRTC());
  await act(async () => result.current.answerCall('call', 'voice', 'caller'));
  expect(result.current.state.callStatus).toBe('connecting');
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(result.current.state.callStatus).toBe('failed');
  expect(result.current.state.callId).toBeNull();
  expect(mocks.media.stopAllMedia).toHaveBeenCalledOnce();
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ call_id: 'call', signal_type: 'call-ended' }));
  expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', end_reason: 'connection_timeout' }));
});

it('keeps the deadline after an offer arrives and ICE starts connecting', async () => {
  const { result } = renderHook(() => useWebRTC());
  await act(async () => result.current.answerCall('call', 'voice', 'caller'));
  await act(async () => mocks.signaling.onOffer({ type: 'offer', sdp: 'test' }, 'caller'));
  act(() => mocks.connection.onConnectionStateChange('connecting'));
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(result.current.state.callStatus).toBe('failed');
  expect(mocks.media.stopAllMedia).toHaveBeenCalledOnce();
});

it('cancels the deadline when the transport connects', async () => {
  const { result } = renderHook(() => useWebRTC());
  await act(async () => result.current.answerCall('call', 'voice', 'caller'));
  act(() => mocks.connection.onConnectionStateChange('connected'));
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(result.current.state.callStatus).toBe('connected');
  expect(mocks.media.stopAllMedia).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

it('cancels the deadline when the other participant hangs up', async () => {
  const { result } = renderHook(() => useWebRTC());
  await act(async () => result.current.answerCall('call', 'voice', 'caller'));
  act(() => mocks.signaling.onEvent({ type: 'ended' }, 'caller'));
  await act(async () => vi.advanceTimersByTimeAsync(120_000));
  expect(result.current.state.callStatus).toBe('ended');
  expect(mocks.media.stopAllMedia).toHaveBeenCalledOnce();
  expect(mocks.update).not.toHaveBeenCalled();
});
