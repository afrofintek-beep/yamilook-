import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[], read: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'viewer' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ order: state.read }) }),
  rpc: async () => ({ data: [{ id: 'mentor', display_name: 'Leticia Silva' }], error: null }),
} }));
import { useAcademiaSessions } from './useAcademia';
let client: QueryClient;
const session = { id: 'rain', title: 'Dança na chuva', mentor_id: 'mentor', scheduled_at: '2026-10-23T02:46:00Z', status: 'live', spots: 1, spots_left: 1, price_coins: 0 };
function mount() {
  return renderHook(() => useAcademiaSessions(), { wrapper: ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={client}>{children}</QueryClientProvider> });
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 300_000, refetchOnWindowFocus: false, retry: false } } });
  state.rows = []; state.read.mockReset();
  state.read.mockImplementation(async () => ({ data: [...state.rows], error: null }));
  focusManager.setFocused(true);
});
afterEach(() => { cleanup(); client.clear(); vi.useRealTimers(); focusManager.setFocused(undefined); });

describe('Academia availability across devices', () => {
  it('refreshes a five-minute cached list immediately on opening Academia', async () => {
    client.setQueryData(['academia-sessions'], []);
    state.rows = [session];
    const { result } = mount();
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('Dança na chuva'));
    expect(result.current.data?.[0]?.status).toBe('live');
  });
  it('discovers a new session and its ended status while the list stays open', async () => {
    vi.useFakeTimers();
    const { result } = mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(result.current.isSuccess).toBe(true);
    state.rows = [session];
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(state.read.mock.calls.length).toBeGreaterThan(1);
    expect(client.getQueryData<{title:string}[]>(['academia-sessions'])?.[0]?.title).toBe('Dança na chuva');
    state.rows = [{ ...session, status: 'ended' }];
    await act(async () => { await vi.advanceTimersByTimeAsync(10_100); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(client.getQueryData<{status:string}[]>(['academia-sessions'])?.[0]?.status).toBe('ended');
  });
  it('refreshes when returning from another app without waiting for the interval', async () => {
    const { result } = mount();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    act(() => focusManager.setFocused(false)); state.rows = [session];
    act(() => focusManager.setFocused(true));
    await waitFor(() => expect(result.current.data?.[0]?.title).toBe('Dança na chuva'));
  });
});
