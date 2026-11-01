import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMessages, useConversations } from './useChat';
type Change = { old?: Record<string, unknown>; new: Record<string, unknown> };
type Filter = { table?: string; event?: string };
type Channel = { handlers: { filter: Filter; callback: (payload: Change) => void }[]; on: (event: string, filter: Filter, callback: (payload: Change) => void) => Channel; status?: (status: string) => void; subscribe: (callback?: (status: string) => void) => Channel };
const m = vi.hoisted(() => ({
  listMode: false, messages: [] as Record<string, unknown>[], holdReceipt: false,
  user: { id: 'me' }, reads: vi.fn(), channels: [] as Channel[], profile: vi.fn(), profiles: vi.fn(),
}));
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: m.user }) }));
vi.mock('./useMessageNotification', () => ({ useMessageNotification: () => ({ notifyMessage: vi.fn() }) }));
vi.mock('@/lib/public-profile-batch', () => ({ fetchPublicProfilesBatched: (...args: unknown[]) => m.profiles(...args), fetchPublicProfileById: (...args: unknown[]) => m.profile(...args) }));
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
    const ch: Channel = { handlers: [], on: (_: string, filter: Filter, callback: (payload: Change) => void) => { ch.handlers.push({ filter, callback }); return ch; }, subscribe: callback => { ch.status = callback; return ch; } };
    m.channels.push(ch); return ch;
  },
  removeChannel: vi.fn(),
} }));
beforeEach(() => { m.listMode = false; m.messages = []; m.holdReceipt = false; m.reads.mockClear(); m.channels.length = 0; m.user = { id: 'me' }; m.profile.mockReset().mockResolvedValue({ data: null }); m.profiles.mockReset().mockResolvedValue({ data: [] }); });
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

const incoming = (id: string, at = '2026-11-01T03:40:00Z') => ({
  id, sender_id: 'other', conversation_id: 'chat', content: id,
  created_at: at, updated_at: at, message_type: 'text',
});
const insertHandler = () => m.channels.flatMap(ch => ch.handlers)
  .find(h => h.filter.table === 'messages' && h.filter.event === 'INSERT')!.callback;

it('renders incoming text immediately when the sender profile request never completes', async () => {
  m.profile.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => insertHandler()({ new: incoming('hello') }));
  expect(result.current.messages.map(message => message.content)).toEqual(['hello']);
});

it('shows initial text without waiting for profiles and reactions', async () => {
  m.messages = [incoming('loaded')];
  m.profiles.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.messages[0].content).toBe('loaded');
});

it('deduplicates realtime inserts and orders messages independently of profile completion', async () => {
  m.profile.mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => {
    insertHandler()({ new: incoming('second', '2026-11-01T03:41:00Z') });
    insertHandler()({ new: incoming('first') });
    insertHandler()({ new: incoming('second', '2026-11-01T03:41:00Z') });
  });
  expect(result.current.messages.map(message => message.id)).toEqual(['first', 'second']);
});

it('reconciles missed messages when the message subscription joins again', async () => {
  const { result } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  m.messages = [incoming('missed')];
  const channel = m.channels.find(ch => ch.handlers.some(h => h.filter.table === 'messages'))!;
  expect(channel.handlers.some(h => h.filter.table === 'conversation_participants')).toBe(false);
  await act(async () => channel.status?.('SUBSCRIBED'));
  expect(result.current.messages[0].id).toBe('missed');
});

it('does not remove a realtime arrival when older history enrichment finishes', async () => {
  let resolve!: (value: unknown) => void;
  m.messages = [incoming('history')];
  m.profiles.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useMessages('chat'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  await act(async () => insertHandler()({ new: incoming('new', '2026-11-01T03:41:00Z') }));
  await act(async () => resolve({ data: [] }));
  expect(result.current.messages.map(message => message.id)).toEqual(['history', 'new']);
});

it('ignores old conversation profile completions and subscription events after switching', async () => {
  let resolve!: (value: unknown) => void;
  m.profile.mockImplementation(() => new Promise(done => { resolve = done; }));
  const { result, rerender } = renderHook(({ id }) => useMessages(id), { initialProps: { id: 'chat' } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  const oldInsert = insertHandler();
  await act(async () => oldInsert({ new: incoming('old') }));
  rerender({ id: 'another-chat' });
  await act(async () => {});
  await act(async () => {
    resolve({ data: { id: 'other', display_name: 'Other' } });
    oldInsert({ new: incoming('late-old') });
  });
  expect(result.current.messages).toEqual([]);
});
