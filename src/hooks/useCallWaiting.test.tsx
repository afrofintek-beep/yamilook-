import { act, renderHook, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCallTransport } from './useCallTransport';

const sessions = vi.hoisted(() => ({ count: 0, events: [] as string[], stale: false }));
vi.mock('./useWebRTC', () => ({ useWebRTC: () => ({ state: { callId: null } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('./useLiveKitCall', () => ({ useLiveKitCall: () => {
  const [slot] = useState(() => sessions.count++);
  const [id, setId] = useState<string | null>(slot === 0 ? 'first' : null);
  return {
    state: { callId: id, callStatus: id ? 'connected' : 'idle' },
    setHeld: async (hold: boolean) => { sessions.events.push(`${id}:${hold ? 'hold' : 'resume'}`); },
    answerCall: async (next: string, _type: string, _target: string, heldId: string) => {
      sessions.events.push(`answer:${next}:${heldId}`);
      if (sessions.stale) throw new Error('expired');
      setId(next);
    },
  };
} }));
afterEach(() => { cleanup(); sessions.count = 0; sessions.events = []; sessions.stale = false; });
it('parks the first session before answering and parks the second before resuming the first', async () => {
  const { result } = renderHook(useCallTransport);
  await act(async () => result.current.holdAndAnswer('second', 'video', 'caller'));
  expect(result.current.heldId).toBe('first');
  await act(async () => { await result.current.switchToHeld(); });
  expect(result.current.state.callId).toBe('first');
  expect(result.current.heldId).toBe('second');
  expect(sessions.events).toEqual(['first:hold', 'answer:second:first', 'second:hold', 'first:resume']);
});
it('restores the original media when the invitation expires during handoff', async () => {
  sessions.stale = true;
  const { result } = renderHook(useCallTransport);
  await expect(result.current.holdAndAnswer('second', 'voice', 'caller')).rejects.toThrow('expired');
  expect(result.current.state.callId).toBe('first');
  expect(sessions.events).toEqual(['first:hold', 'answer:second:first', 'first:resume']);
});
