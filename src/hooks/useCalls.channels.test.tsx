import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useCalls, type Call } from './useCalls';

type Channel = { name: string; joined: boolean; handlers: ((payload: { new: { status: string } }) => void)[]; on: (...args: unknown[]) => Channel; subscribe: () => Channel };
const m = vi.hoisted(() => ({
  user: { id: 'me' }, channels: new Map<string, Channel>(), removed: vi.fn(),
  poll: vi.fn(),
}));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock('./useIncomingCallSignals', () => ({ useIncomingCallSignals: vi.fn() }));
vi.mock('@/features/scheduled-calls/useScheduledCalls', () => ({ useScheduledCalls: () => ({ scheduledCalls: [] }) }));
vi.mock('@/lib/direct-call-reconciliation', () => ({ reconcileDirectCalls: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => q,
      maybeSingle: () => table === 'calls' ? m.poll() : Promise.resolve({ data: null, error: null }) };
    return q;
  },
  // Reproduce Supabase's same-topic reuse and its guard against adding
  // postgres_changes callbacks after subscribe(), as seen in the device stack.
  channel: (name: string) => {
    const existing = m.channels.get(name);
    if (existing) return existing;
    const channel: Channel = { name, joined: false, handlers: [],
      on: (_event, _filter, handler) => {
        if (channel.joined) throw new Error('cannot add postgres_changes callbacks after subscribe()');
        channel.handlers.push(handler as Channel['handlers'][number]); return channel;
      }, subscribe: () => { channel.joined = true; return channel; } };
    m.channels.set(name, channel); return channel;
  },
  // Leave channels registered to simulate asynchronous unsubscribe completion.
  removeChannel: (channel: Channel) => { m.removed(channel); return new Promise(() => {}); },
} }));
const call = (id: string) => ({ id, status: 'ringing', type: 'voice', initiator_id: 'caller' } as Call);
const watchers = () => [...m.channels.values()].filter(channel => channel.name.startsWith('call-status-watch-'));
beforeEach(() => { m.channels.clear(); m.removed.mockClear(); m.poll.mockReset().mockResolvedValue({ data: { status: 'ringing' }, error: null }); vi.useFakeTimers(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('lets the global listener and history page watch the same call without sharing a subscribed channel', async () => {
  const { result } = renderHook(() => [useCalls({ loadHistory: false }), useCalls({ loadHistory: false })]);
  await act(async () => { result.current.forEach(hook => hook.setIncomingCall(call('same-call'))); });
  expect(watchers()).toHaveLength(2);
  expect(new Set(watchers().map(channel => channel.name)).size).toBe(2);
  await act(async () => { watchers().forEach(channel => channel.handlers[0]({ new: { status: 'ended' } })); });
  expect(result.current.every(hook => hook.incomingCall === null)).toBe(true);
});

it('reopens the same call safely while the old unsubscribe is pending', async () => {
  const { result } = renderHook(() => useCalls({ loadHistory: false }));
  await act(async () => result.current.setIncomingCall(call('same-call')));
  const old = watchers()[0];
  await act(async () => result.current.setIncomingCall(null));
  await act(async () => result.current.setIncomingCall(call('same-call')));
  expect(watchers()).toHaveLength(2);
  expect(m.removed).toHaveBeenCalledWith(old);
  await act(async () => old.handlers[0]({ new: { status: 'ended' } }));
  expect(result.current.incomingCall?.id).toBe('same-call');
});

it('ignores a late status poll from a previous call', async () => {
  let resolve!: (value: unknown) => void;
  m.poll.mockReturnValueOnce(new Promise(finish => { resolve = finish; }));
  const { result } = renderHook(() => useCalls({ loadHistory: false }));
  await act(async () => result.current.setIncomingCall(call('old-call')));
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  await act(async () => result.current.setIncomingCall(call('new-call')));
  await act(async () => resolve({ data: { status: 'ended' }, error: null }));
  expect(result.current.incomingCall?.id).toBe('new-call');
});
