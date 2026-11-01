import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMessageRecovery } from './useMessageRecovery';

const m = vi.hoisted(() => ({ query: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: (table: string) => {
    m.from(table);
    const q: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'or', 'order']) q[method] = () => q;
    q.limit = () => m.query();
    return q;
  },
} }));
beforeEach(() => {
  vi.useFakeTimers();
  m.from.mockClear();
  m.query.mockReset().mockResolvedValue({ data: [{ id: 'new', updated_at: 'now' }], error: null });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('recovers a missed insert with a bounded probe without marking history read', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  renderHook(() => useMessageRecovery('chat', 'me', [], refresh));
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(m.from).toHaveBeenCalledWith('visible_messages');
  expect(refresh).toHaveBeenCalledExactlyOnceWith(false);
});

it('does not reload history when the newest message is already present', async () => {
  const refresh = vi.fn();
  renderHook(() => useMessageRecovery('chat', 'me', [{ id: 'new', updated_at: 'now' }], refresh));
  await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
  expect(m.query).toHaveBeenCalledTimes(3);
  expect(refresh).not.toHaveBeenCalled();
});

it('pauses probes in background/offline and recovers immediately on resume', async () => {
  const refresh = vi.fn();
  renderHook(() => useMessageRecovery('chat', 'me', [], refresh));
  Object.defineProperty(document, 'visibilityState', { value: 'hidden' });
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(m.query).not.toHaveBeenCalled();
  Object.defineProperty(document, 'visibilityState', { value: 'visible' });
  Object.defineProperty(navigator, 'onLine', { value: false });
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(m.query).not.toHaveBeenCalled();
  Object.defineProperty(navigator, 'onLine', { value: true });
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(refresh).toHaveBeenCalledOnce();
});

it('coalesces slow probes and ignores their result after changing conversation', async () => {
  let resolve!: (value: unknown) => void;
  m.query.mockImplementation(() => new Promise(done => { resolve = done; }));
  const refresh = vi.fn();
  const { rerender, unmount } = renderHook(({ id }) => useMessageRecovery(id, 'me', [], refresh),
    { initialProps: { id: 'chat' } });
  await act(async () => { await vi.advanceTimersByTimeAsync(20000); });
  expect(m.query).toHaveBeenCalledOnce();
  rerender({ id: 'other-chat' });
  await act(async () => resolve({ data: [{ id: 'old', updated_at: 'now' }] }));
  expect(refresh).not.toHaveBeenCalled();
  unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(m.query).toHaveBeenCalledOnce();
});

it('does not probe without an authenticated account', async () => {
  renderHook(() => useMessageRecovery('chat', undefined, [], vi.fn()));
  await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
  expect(m.query).not.toHaveBeenCalled();
});
