import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCallTransport } from './useCallTransport';
const m = vi.hoisted(() => ({ read: vi.fn(), oldDecline: vi.fn(), newDecline: vi.fn(), oldAnswer: vi.fn(), newAnswer: vi.fn(), start: vi.fn(), end: vi.fn() }));
vi.mock('./useWebRTC', () => ({ useWebRTC: () => ({ state: { callId: null }, declineCall: m.oldDecline, answerCall: m.oldAnswer, endCall: m.end, markUserInteracted: vi.fn() }) }));
vi.mock('./useLiveKitCall', () => ({ useLiveKitCall: () => ({ state: { callId: null }, declineCall: m.newDecline, answerCall: m.newAnswer, initiateCall: m.start, endCall: m.end, markUserInteracted: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ single: m.read }) }) }) } }));
beforeEach(() => vi.resetAllMocks()); afterEach(cleanup);
it('routes existing WebRTC calls and group calls to their original engine', async () => {
  const { result } = renderHook(useCallTransport);
  for (const data of [{ sdp_offer: null, is_group_call: false }, { sdp_offer: { transport: 'livekit-v1' }, is_group_call: true }]) {
    m.read.mockResolvedValue({ data });
    await act(async () => result.current.answerCall('id', 'voice', 'other'));
  }
  expect(m.oldAnswer).toHaveBeenCalledTimes(2); expect(m.newAnswer).not.toHaveBeenCalled();
});
it('routes marked direct calls to LiveKit', async () => {
  m.read.mockResolvedValue({ data: { sdp_offer: { transport: 'livekit-v1' }, is_group_call: false } });
  const { result } = renderHook(useCallTransport);
  await act(async () => result.current.answerCall('id', 'video', 'other'));
  expect(m.newAnswer).toHaveBeenCalledWith('id', 'video', 'other'); expect(m.oldAnswer).not.toHaveBeenCalled();
});
it('never answers after the user hangs up during the database lookup', async () => {
  let resolve!: (v: unknown) => void;
  m.read.mockReturnValue(new Promise(r => { resolve = r; }));
  const { result } = renderHook(useCallTransport);
  let answer!: Promise<unknown>;
  act(() => { answer = result.current.answerCall('id', 'voice', 'other').catch(e => e); });
  await act(async () => { await result.current.endCall(); resolve({ data: { sdp_offer: { transport: 'livekit-v1' } } }); await answer; });
  expect(m.newAnswer).not.toHaveBeenCalled(); expect(m.oldAnswer).not.toHaveBeenCalled();
});

it('preserves group decline and uses the atomic direct-call outcome for direct calls', async () => {
  const { result } = renderHook(useCallTransport);
  m.read.mockResolvedValue({data:{is_group_call:true}});
  await result.current.declineCall('group','caller');
  expect(m.oldDecline).toHaveBeenCalledWith('group','caller');
  m.read.mockResolvedValue({data:{is_group_call:false}});
  await result.current.declineCall('direct','caller');
  expect(m.newDecline).toHaveBeenCalledWith('direct','caller');
});
