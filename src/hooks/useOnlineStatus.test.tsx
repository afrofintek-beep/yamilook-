import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';
const { rpc, single, removeChannel, channel } = vi.hoisted(() => {
  const rpc = vi.fn(); const single = vi.fn(); const removeChannel = vi.fn();
  const channel = { on: vi.fn(), subscribe: vi.fn() };
  return { rpc, single, removeChannel, channel };
});
vi.mock('./useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc, removeChannel, channel: () => channel,
  from: () => ({ select: () => ({ eq: () => ({ single }) }) }),
} }));
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  channel.on.mockReturnValue(channel); channel.subscribe.mockReturnValue(channel);
  rpc.mockResolvedValue({ error: null });
  single.mockResolvedValue({ data: { show_online_status: true }, error: null });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
});
afterEach(async () => { cleanup(); await flush(); vi.useRealTimers(); });
describe('online lease renewal', () => {
  it('renews every 30 seconds while visible, and releases on backgrounding', async () => {
    renderHook(() => useOnlineStatus()); await flush();
    expect(rpc).toHaveBeenLastCalledWith('renew_online_presence', expect.objectContaining({ p_active: true }));
    await act(async () => { vi.advanceTimersByTime(30_000); });
    expect(rpc).toHaveBeenCalledTimes(2);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await flush();
    expect(rpc).toHaveBeenLastCalledWith('renew_online_presence', expect.objectContaining({ p_active: false }));
    const calls = rpc.mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(90_000); });
    expect(rpc).toHaveBeenCalledTimes(calls);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await flush();
    expect(rpc).toHaveBeenLastCalledWith('renew_online_presence', expect.objectContaining({ p_active: true }));
  });
  it('honours privacy before sending the first heartbeat', async () => {
    single.mockResolvedValue({ data: { show_online_status: false }, error: null });
    renderHook(() => useOnlineStatus()); await flush();
    expect(rpc).toHaveBeenLastCalledWith('renew_online_presence', expect.objectContaining({ p_active: false }));
    await act(async () => { vi.advanceTimersByTime(60_000); });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('releases only its own client lease on unmount', async () => {
    const { unmount } = renderHook(() => useOnlineStatus()); await flush();
    const clientId = rpc.mock.calls[0][1].p_client_id;
    unmount(); await flush();
    expect(rpc).toHaveBeenLastCalledWith('renew_online_presence', { p_client_id: clientId, p_active: false });
  });
});
