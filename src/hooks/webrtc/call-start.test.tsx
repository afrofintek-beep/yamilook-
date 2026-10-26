import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCallRecipient } from './call-preflight';
import { useWebRTC } from '../useWebRTC';

const m = vi.hoisted(() => {
  const user = { id: '00000000-0000-4000-8000-000000000001' };
  const stream = { getAudioTracks: () => [], getTracks: () => [], getVideoTracks: () => [] };
  const media = { getUserMedia: vi.fn(), localStreamRef: { current: stream }, stopAllMedia: vi.fn() };
  const pc = { createOffer: vi.fn(), setLocalDescription: vi.fn(), localDescription: { type: 'offer', sdp: 'test-sdp' } };
  const peers = { createPeerConnection: vi.fn(() => pc), closeAllPeerConnections: vi.fn(), peerConnections: { current: new Map() } };
  const lifecycle = { createCallInDB: vi.fn(), clearRingTimeout: vi.fn(), setRingTimeout: vi.fn(), updateParticipantStatus: vi.fn(), updateCallStatus: vi.fn() };
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), in: vi.fn(), insert: vi.fn(), update: vi.fn(), then: vi.fn() };
  const ice = { clearAllQueues: vi.fn(), flushOutgoingCandidates: vi.fn(() => []) };
  const autoplay = { tryPlayRemoteStream: vi.fn(), markUserInteracted: vi.fn() };
  const telemetry = { logFinalMetrics: vi.fn() };
  const servers = { getServersForCall: vi.fn(), iceServers: [] };
  return { user, stream, media, pc, peers, lifecycle, query, ice, autoplay, telemetry, servers };
});
vi.mock('../useAuth', () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => m.query } }));
vi.mock('../useICEServers', () => ({ useICEServers: () => m.servers }));
vi.mock('../useWebRTCSignaling', () => ({ useWebRTCSignaling: () => ({}) }));
vi.mock('./useMediaCapture', () => ({ useMediaCapture: () => m.media }));
vi.mock('./usePeerConnection', () => ({ usePeerConnection: () => m.peers }));
vi.mock('./useCallLifecycle', () => ({ useCallLifecycle: () => m.lifecycle }));
vi.mock('./useICECandidateQueue', () => ({ useICECandidateQueue: () => m.ice }));
vi.mock('./useAutoplayRecovery', () => ({ useAutoplayRecovery: () => m.autoplay }));
vi.mock('./useCallTelemetry', () => ({ useCallTelemetry: () => m.telemetry }));
vi.mock('./call-termination', () => ({ watchCallTermination: () => () => {}, finishCallLocallyFirst: vi.fn() }));
vi.mock('@/lib/virtualBackground', () => ({ DEFAULT_EFFECTS: {}, effectsActive: vi.fn(), VirtualBackgroundProcessor: {} }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
const other = '00000000-0000-4000-8000-000000000002';
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  for (const key of ['select', 'eq', 'update'] as const) m.query[key].mockReturnValue(m.query);
  m.query.maybeSingle.mockResolvedValue({ data: { id: other }, error: null });
  m.query.insert.mockResolvedValue({ error: null });
  m.query.in.mockResolvedValue({ error: null });
  m.media.getUserMedia.mockResolvedValue(m.stream);
  m.lifecycle.createCallInDB.mockResolvedValue('call-id');
  m.lifecycle.updateParticipantStatus.mockResolvedValue(undefined);
  m.lifecycle.updateCallStatus.mockResolvedValue(undefined);
  m.servers.getServersForCall.mockResolvedValue([{ urls: 'stun:test' }]);
  m.pc.createOffer.mockResolvedValue({ type: 'offer', sdp: 'test-sdp' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('call recipient preflight', () => {
  it.each(['voice', 'video'] as const)('blocks self %s before ICE, media, database or peer creation', async type => {
    const { result } = renderHook(() => useWebRTC());
    await expect(result.current.initiateCall(m.user.id, type)).rejects.toThrow('própria conta');
    expect(m.servers.getServersForCall).not.toHaveBeenCalled();
    expect(m.media.getUserMedia).not.toHaveBeenCalled();
    expect(m.lifecycle.createCallInDB).not.toHaveBeenCalled();
    expect(m.peers.createPeerConnection).not.toHaveBeenCalled();
  });
  it.each(['', 'bad-id'])('rejects malformed recipient %s', id => {
    expect(() => validateCallRecipient(m.user.id, id)).toThrow('Destinatário inválido');
  });
  it('rejects unauthenticated users and case variants of self', () => {
    expect(() => validateCallRecipient(undefined, other)).toThrow('Inicia sessão');
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    expect(() => validateCallRecipient(id, id.toUpperCase())).toThrow('própria conta');
  });
  it.each([{ data: null, error: null }, { data: null, error: { message: 'network' } }])('fails closed on absent or unverifiable recipient', async response => {
    m.query.maybeSingle.mockResolvedValue(response);
    const { result } = renderHook(() => useWebRTC());
    await act(async () => { await expect(result.current.initiateCall(other, 'voice')).rejects.toThrow(); });
    expect(m.media.getUserMedia).not.toHaveBeenCalled();
    expect(m.lifecycle.createCallInDB).not.toHaveBeenCalled();
  });
  it.each(['voice', 'video'] as const)('starts a %s call to a different account and sends SDP', async type => {
    const { result } = renderHook(() => useWebRTC());
    await act(async () => { expect(await result.current.initiateCall(other, type)).toBe('call-id'); });
    expect(m.media.getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ videoEnabled: type === 'video', audioEnabled: true }));
    expect(m.lifecycle.createCallInDB).toHaveBeenCalledWith(other, type, undefined);
    expect(m.query.insert).toHaveBeenCalledWith(expect.objectContaining({ to_user_id: other, signal_type: 'offer' }));
    expect(result.current.state.callStatus).toBe('ringing'); // not proof of a connection
  });
  it('does not create a call after media refusal', async () => {
    m.media.getUserMedia.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const { result } = renderHook(() => useWebRTC());
    await act(async () => { await expect(result.current.initiateCall(other, 'video')).rejects.toThrow('denied'); });
    expect(m.lifecycle.createCallInDB).not.toHaveBeenCalled();
  });
  it('releases media when call creation fails', async () => {
    m.lifecycle.createCallInDB.mockRejectedValueOnce(new Error('RPC unavailable'));
    const { result } = renderHook(() => useWebRTC());
    await act(async () => { await expect(result.current.initiateCall(other, 'voice')).rejects.toThrow('RPC unavailable'); });
    expect(m.media.stopAllMedia).toHaveBeenCalled();
    expect(m.peers.createPeerConnection).not.toHaveBeenCalled();
  });
  it('fails and releases resources after two rejected offer writes', async () => {
    m.query.insert.mockResolvedValue({ error: { message: 'RLS' } });
    const { result } = renderHook(() => useWebRTC());
    await act(async () => {
      const assertion = expect(result.current.initiateCall(other, 'voice')).rejects.toThrow('Falha ao enviar');
      await vi.advanceTimersByTimeAsync(500);
      await assertion;
    });
    expect(m.query.insert).toHaveBeenCalledTimes(2);
    expect(m.query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    expect(m.media.stopAllMedia).toHaveBeenCalled();
  });
  it('does not accept when participant update fails', async () => {
    m.lifecycle.updateParticipantStatus.mockRejectedValueOnce(new Error('update denied'));
    const { result } = renderHook(() => useWebRTC());
    await act(async () => { await expect(result.current.answerCall('call-id', 'voice', other)).rejects.toThrow('update denied'); });
    expect(m.query.insert).not.toHaveBeenCalled();
    expect(m.media.stopAllMedia).toHaveBeenCalled();
  });
  it('does not show connecting when acceptance signaling fails', async () => {
    m.query.insert.mockResolvedValue({ error: { message: 'RLS' } });
    const { result } = renderHook(() => useWebRTC());
    await act(async () => { await expect(result.current.answerCall('call-id', 'voice', other)).rejects.toThrow('aceitação'); });
    expect(result.current.state.callStatus).toBe('failed');
    expect(m.media.stopAllMedia).toHaveBeenCalled();
  });
});
