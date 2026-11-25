import { act, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useIntegrationAccess } from './useIntegrationAccess';

const state = vi.hoisted(() => ({
  user: { id: 'admin', last_sign_in_at: 'first-session' } as { id: string; last_sign_in_at: string } | null,
  read: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('./api', () => ({ getIntegrationAccess: (...args: unknown[]) => state.read(...args) }));

beforeEach(() => {
  onlineManager.setOnline(true);
  state.user = { id: 'admin', last_sign_in_at: 'first-session' };
  state.read.mockReset();
});
function fixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hook = renderHook(() => useIntegrationAccess(), {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
  return { ...hook, client };
}

it('hides both integrations while loading and enables only the server-selected feature', async () => {
  let resolve!: (value: unknown) => void;
  state.read.mockImplementation(() => new Promise(done => { resolve = done; }));
  const hook = fixture();
  expect(hook.result.current).toMatchObject({ googleMaps: false, maguela: false, loading: true });
  await act(async () => resolve({ userId: 'admin', googleMaps: true, maguela: false, admin: false }));
  await waitFor(() => expect(hook.result.current.googleMaps).toBe(true));
  expect(hook.result.current.maguela).toBe(false);
  hook.unmount(); hook.client.clear();
});

it('rejects mismatched identities and never accepts a failed lookup', async () => {
  state.read.mockResolvedValue({ userId: 'someone-else', googleMaps: true, maguela: true, admin: true });
  const hook = fixture();
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current).toMatchObject({ googleMaps: false, maguela: false, admin: false });
  hook.unmount(); hook.client.clear();
});

it('removes grants immediately on logout and does not reuse an administrator result for a new account', async () => {
  state.read.mockResolvedValue({ userId: 'admin', googleMaps: true, maguela: true, admin: true });
  const hook = fixture();
  await waitFor(() => expect(hook.result.current.maguela).toBe(true));
  state.user = null;
  hook.rerender();
  expect(hook.result.current).toMatchObject({ googleMaps: false, maguela: false, admin: false });
  state.read.mockImplementation(() => new Promise(() => {}));
  state.user = { id: 'ordinary', last_sign_in_at: 'new-session' };
  hook.rerender();
  expect(hook.result.current).toMatchObject({ googleMaps: false, maguela: false, admin: false, loading: true });
  hook.unmount(); hook.client.clear();
});

it('removes only the revoked feature after refresh and closes both on a later verification error', async () => {
  state.read.mockResolvedValue({ userId: 'admin', googleMaps: true, maguela: true, admin: false });
  const hook = fixture();
  await waitFor(() => expect(hook.result.current.googleMaps).toBe(true));
  state.read.mockResolvedValue({ userId: 'admin', googleMaps: false, maguela: true, admin: false });
  await act(async () => { await hook.client.invalidateQueries({ queryKey: ['integration-access'] }); });
  await waitFor(() => expect(hook.result.current.googleMaps).toBe(false));
  expect(hook.result.current.maguela).toBe(true);
  state.read.mockRejectedValue(new Error('offline'));
  await act(async () => { await hook.client.invalidateQueries({ queryKey: ['integration-access'] }); });
  await waitFor(() => expect(hook.result.current.maguela).toBe(false));
  hook.unmount(); hook.client.clear();
});

it('hides cached grants when offline and waits for fresh permission after reconnecting', async () => {
  state.read.mockResolvedValue({ userId: 'admin', googleMaps: true, maguela: true, admin: false });
  const hook = fixture();
  await waitFor(() => expect(hook.result.current.googleMaps).toBe(true));
  act(() => onlineManager.setOnline(false));
  expect(hook.result.current).toMatchObject({ googleMaps: false, maguela: false });
  let resolve!: (value: unknown) => void;
  state.read.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => { onlineManager.setOnline(true); });
  expect(hook.result.current).toMatchObject({ googleMaps: false, maguela: false });
  await waitFor(() => expect(resolve).toBeTypeOf('function'));
  await act(async () => resolve({ userId: 'admin', googleMaps: false, maguela: true, admin: false }));
  await waitFor(() => expect(hook.result.current.maguela).toBe(true));
  expect(hook.result.current.googleMaps).toBe(false);
  hook.unmount(); hook.client.clear();
});
