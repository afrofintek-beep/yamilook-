import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMessages, useConversations } from './useChat';
type Change = { old?: Record<string, unknown>; new: Record<string, unknown> };
type Filter = { table?: string };
type Channel = { handlers: { filter: Filter; callback: (payload: Change) => void }[]; on: (event: string, filter: Filter, callback: (payload: Change) => void) => Channel; subscribe: () => Channel };
const m = vi.hoisted(() => ({
  listMode: false, messages: [] as Record<string, unknown>[], holdReceipt: false,
  user: { id: 'me' }, reads: vi.fn(), channels: [] as Channel[],
}));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock('./useMessageNotification', () => ({ useMessageNotification: () => ({ notifyMessage: vi.fn() }) }));
vi.mock('@/lib/public-profile-batch', () => ({ fetchPublicProfilesBatched: vi.fn().mockResolvedValue({ data: [] }), fetchPublicProfileById: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: vi.fn().mockResolvedValue({ data: [{ conversation_id: 'chat', last_message: null, unread_count: 0 }], error: null }),
  from: (table: string) => {
    let updating = false;
    const q: Record<string, (...args: unknown[]) => unknown> = {};
    for (const method of ['select', 'eq', 'or', 'order', 'in', 'update']) q[method] = () => q;
    q.update = () => { updating = true; return q; };
    const result = () => {
      m.reads(table);
      return { data: table === 'conversation_participants' ? (m.listMode ? [{ conversation_id: 'chat', is_archived: false, user_id: 'me' }] : { history_cleared_at: null }) : table === 'visible_messages' ? m.messages : [], error: null };
    };
    q.single = async () => result();
    q.then = (resolve: (value: unknown) => unknown) => updating && m.holdReceipt ? new Promise(() => {}) : Promise.resolve(result()).then(resolve);
    return q;
  },
  channel: () => {
    const ch: Channel = { handlers: [], on: (_: string, filter: Filter, callback: (payload: Change) => void) => { ch.handlers.push({ filter, callback }); return ch; }, subscribe: () => ch };
    m.channels.push(ch); return ch;
  },
  removeChannel: vi.fn(),
} }));
beforeEach(() => { m.listMode = false; m.messages = []; m.holdReceipt = false; m.reads.mockClear(); m.channels.length = 0; m.user = { id: 'me' }; });
afterEach(cleanup);
it('does not reload history or resubscribe when the same user receives a refreshed auth object', async () => {
  const { rerender } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(m.reads).toHaveBeenCalledWith('visible_messages'));
  m.reads.mockClear();
  const subscriptions = m.channels.length;
  m.user = { id: 'me' };
  rerender();
  await act(async () => {});
  expect(m.reads).not.toHaveBeenCalled();
  expect(m.channels).toHaveLength(subscriptions);
});
it('ignores read receipts but reloads history when the current user history cutoff changes', async () => {
  renderHook(() => useMessages('chat'));
  await waitFor(() => expect(m.reads).toHaveBeenCalledWith('visible_messages'));
  const handler = m.channels.flatMap(ch => ch.handlers).find(h => h.filter.table === 'conversation_participants').callback;
  m.reads.mockClear();
  await act(async () => handler({ old: { id: 'p' }, new: { user_id: 'me', history_cleared_at: null, last_read_at: 'now' } }));
  expect(m.reads).not.toHaveBeenCalled();
  await act(async () => handler({ old: { id: 'p' }, new: { user_id: 'me', history_cleared_at: '2026-10-28T10:00:00Z' } }));
  expect(m.reads).toHaveBeenCalledWith('visible_messages');
});

it('still reloads and resubscribes when the authenticated account changes', async () => {
  const { rerender } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(m.reads).toHaveBeenCalledWith('visible_messages'));
  m.reads.mockClear();
  const subscriptions = m.channels.length;
  m.user = { id: 'another-account' };
  rerender();
  await waitFor(() => expect(m.reads).toHaveBeenCalledWith('visible_messages'));
  expect(m.channels.length).toBeGreaterThan(subscriptions);
});

it('shows loaded messages even while the read receipt request is pending', async () => {
  m.messages = [{ id: 'message', sender_id: 'other', conversation_id: 'chat', content: 'Olá', created_at: new Date().toISOString() }];
  m.holdReceipt = true;
  const { result } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.messages[0].content).toBe('Olá');
});

it('reuses participation data and keeps conversation subscriptions stable on token refresh', async () => {
  m.listMode = true;
  const { result, rerender } = renderHook(useConversations);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(m.reads.mock.calls.filter(([table]) => table === 'conversation_participants')).toHaveLength(2);
  expect(m.reads).not.toHaveBeenCalledWith('visible_messages');
  const subscriptions = m.channels.length;
  m.reads.mockClear(); m.user = { id: 'me' }; rerender();
  await act(async () => {});
  expect(m.reads).not.toHaveBeenCalled();
  expect(m.channels).toHaveLength(subscriptions);
});
