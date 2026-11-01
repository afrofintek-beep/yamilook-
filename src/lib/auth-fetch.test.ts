import { afterEach, expect, it, vi } from 'vitest';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { createAuthFetch } from './auth-fetch';

const project = 'https://example.supabase.co';
const refreshUrl = `${project}/auth/v1/token?grant_type=refresh_token`;
afterEach(() => vi.useRealTimers());

it('backs off refresh rate limits while leaving password login and real rejection unchanged', async () => {
  vi.useFakeTimers();
  const network = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }));
  const fetcher = createAuthFetch(project, network);
  await expect(fetcher(refreshUrl)).rejects.toSatisfy(isAuthRetryableFetchError);
  await expect(fetcher(refreshUrl)).rejects.toSatisfy(isAuthRetryableFetchError);
  expect(network).toHaveBeenCalledTimes(1);
  expect((await fetcher(`${project}/auth/v1/token?grant_type=password`)).status).toBe(429);
  await vi.advanceTimersByTimeAsync(60_000);
  network.mockResolvedValue(new Response('{"code":"refresh_token_not_found"}', { status: 400 }));
  expect((await fetcher(refreshUrl)).status).toBe(400);
});

it('preserves an expired stored session on 429 and recovers on the next successful refresh', async () => {
  vi.useFakeTimers();
  const key = 'auth-rate-limit-test';
  const session = { access_token: 'old-access', refresh_token: 'old-refresh', expires_at: Date.now() / 1000 - 10, expires_in: 3600, token_type: 'bearer', user: { id: 'user-one' } };
  const values = new Map([[key, JSON.stringify(session)]]);
  const network = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"code":"over_request_rate_limit"}', { status: 429 }));
  const client = createClient(project, 'public-test-key', {
    global: { fetch: createAuthFetch(project, network) },
    auth: { autoRefreshToken: false, detectSessionInUrl: false, storageKey: key,
      storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } } },
  });
  await client.auth.initialize();
  const events: string[] = [];
  const { data: { subscription } } = client.auth.onAuthStateChange(event => { events.push(event); });
  const refresh = client.auth.getSession();
  await vi.advanceTimersByTimeAsync(31_000);
  const result = await refresh;
  expect(isAuthRetryableFetchError(result.error)).toBe(true);
  expect(values.has(key)).toBe(true);
  expect(events).not.toContain('SIGNED_OUT');
  expect(network).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60_000);
  network.mockImplementation(async () => new Response(JSON.stringify({ ...session, access_token: 'new-access', refresh_token: 'new-refresh', expires_at: Date.now() / 1000 + 3600 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  expect((await client.auth.getSession()).data.session?.access_token).toBe('new-access');
  await vi.advanceTimersByTimeAsync(3_601_000);
  network.mockImplementation(async () => new Response(JSON.stringify({ error_code: 'refresh_token_not_found', msg: 'Refresh token not found' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
  expect((await client.auth.getSession()).data.session).toBeNull();
  expect(values.has(key)).toBe(false);
  expect(events).toContain('SIGNED_OUT');
  subscription.unsubscribe();
  await client.auth.stopAutoRefresh();
});
