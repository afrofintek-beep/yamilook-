import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';

const fixture = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; title: string; host_id: string; livekit_room_name: string; space: string }>,
  write: vi.fn(),
  read: vi.fn(),
  filters: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'host' } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => {
    let updating = false;
    const builder = {
      select: () => builder,
      update: () => { updating = true; return builder; },
      eq: (key: string, value: string) => { fixture.filters(key, value); return builder; },
      order: () => builder,
      limit: () => { fixture.read(); return Promise.resolve({ data: fixture.rows, error: null }); },
      single: () => fixture.write(),
      then: (resolve: (result: unknown) => unknown) => {
        if (!updating) fixture.read();
        return Promise.resolve({ data: fixture.rows, error: null }).then(resolve);
      },
    };
    return builder;
  },
  rpc: async () => ({ data: [{ id: 'host', display_name: 'Host' }] }),
} }));

import { useEndConversa, useSpaceConversas, type Conversa } from './useMokubicoConversas';
import { useLiveSpaces } from './useMokubicoData';

const room = (id: string): Conversa => ({ id, title: id, hostId: 'host', hostName: 'Host', roomName: id, isHost: true });
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.rows = [];
  fixture.write.mockResolvedValue({ data: { id: 'ended' }, error: null });
  client = new QueryClient({ defaultOptions: { queries: {
    retry: false, staleTime: 300_000, refetchOnWindowFocus: false,
  }, mutations: { retry: false } } });
  focusManager.setFocused(true);
});
afterEach(() => { cleanup(); client.clear(); focusManager.setFocused(undefined); });

describe('ending a Mokubico conversa', () => {
  it('removes only the confirmed room before returning to the cached list and clears old badges', async () => {
    client.setQueryData(['mokubico-conversas', 'sala', 'host'], [room('ended'), room('still-live')]);
    client.setQueryData(['mokubico-conversas', 'quarto', 'host'], [room('other-space')]);
    client.setQueryData(['mokubico-live-spaces', 'host'], new Set(['sala', 'quarto']));
    const { result } = renderHook(useEndConversa, { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync('ended'); });
    expect(client.getQueryData(['mokubico-conversas', 'sala', 'host'])).toEqual([room('still-live')]);
    expect(client.getQueryData(['mokubico-conversas', 'quarto', 'host'])).toEqual([room('other-space')]);
    expect(client.getQueryData(['mokubico-live-spaces', 'host'])).toBeUndefined();
    expect(fixture.filters).toHaveBeenCalledWith('host_id', 'host');
  });

  it.each([
    { data: null, error: new Error('Network unavailable') },
    { data: null, error: null },
  ])('keeps the live cache intact if the write is not confirmed (%j)', async (response) => {
    fixture.write.mockResolvedValue(response);
    client.setQueryData(['mokubico-conversas', 'sala', 'host'], [room('ended')]);
    const { result } = renderHook(useEndConversa, { wrapper: Wrapper });
    await act(async () => { await expect(result.current.mutateAsync('ended')).rejects.toThrow(); });
    expect(client.getQueryData(['mokubico-conversas', 'sala', 'host'])).toEqual([room('ended')]);
  });

  it('does not let an in-flight stale list response resurrect the ended room', async () => {
    const key = ['mokubico-conversas', 'sala', 'host'];
    client.setQueryData(key, [room('ended')]);
    let resolveRead!: (rooms: Conversa[]) => void;
    const oldRead = client.fetchQuery({ queryKey: key, staleTime: 0,
      queryFn: () => new Promise<Conversa[]>((resolve) => { resolveRead = resolve; }),
    }).catch(() => undefined);
    const { result } = renderHook(useEndConversa, { wrapper: Wrapper });
    await act(async () => { await result.current.mutateAsync('ended'); });
    resolveRead([room('ended')]);
    await oldRead;
    expect(client.getQueryData(key)).toEqual([]);
  });
});

it('refreshes a recently cached room list immediately on return, without waiting for polling', async () => {
  client.setQueryData(['mokubico-conversas', 'sala', 'host'], [room('ended')]);
  const { result } = renderHook(() => useSpaceConversas('sala'), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.data).toEqual([]));
  expect(fixture.read).toHaveBeenCalledTimes(1);
});

it('refreshes live badges on return without hiding another active room in the same space', async () => {
  fixture.rows = [{ id: 'other', title: 'Other', host_id: 'host', livekit_room_name: 'other', space: 'sala' }];
  client.setQueryData(['mokubico-live-spaces', 'host'], new Set(['sala', 'quarto']));
  const { result } = renderHook(useLiveSpaces, { wrapper: Wrapper });
  await waitFor(() => expect(result.current.data).toEqual(new Set(['sala'])));
});

it('refreshes the room list when the app returns to the foreground', async () => {
  fixture.rows = [{ id: 'ended', title: 'Aniversário', host_id: 'host', livekit_room_name: 'room', space: 'sala' }];
  const { result } = renderHook(() => useSpaceConversas('sala'), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.data).toHaveLength(1));
  act(() => focusManager.setFocused(false));
  fixture.rows = [];
  act(() => focusManager.setFocused(true));
  await waitFor(() => expect(result.current.data).toEqual([]));
});
