import { test, expect } from '@playwright/test';

const me = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const callId = '44444444-4444-4444-8444-444444444444';

test('incoming call survives session refresh with history open and slow unsubscribe', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let ringing = true;
  await page.route('**/papos-app/**', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    await route.fulfill({ response: await page.request.get('/papos-app/index.html') });
  });
  // Synthetic API responses only; no real accounts, media or production writes.
  await page.route('**/127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop();
    let data: unknown = [];
    if (table === 'user') data = { id: me, email: 'test@example.invalid' };
    if (table === 'profiles') data = { id: me, display_name: 'Teste', onboarding_completed: true, app_tour_completed: true };
    if (table === 'public_profiles') data = { id: peer, display_name: 'Chamador de teste', avatar_url: null };
    if (table === 'call_participants' && url.searchParams.get('status') === 'eq.ringing') {
      data = ringing ? { call_id: callId, status: 'ringing', created_at: new Date().toISOString() } : null;
    }
    if (table === 'calls') data = { id: callId, type: 'voice', initiator_id: peer, status: ringing ? 'ringing' : 'ended', is_group_call: false };
    if (table === 'token') data = {
      access_token: btoa('{}') + '.' + btoa(JSON.stringify({ sub: me, exp: Math.floor(Date.now() / 1000) + 7200 })) + '.signature',
      refresh_token: 'renewed-test-only', expires_in: 7200, token_type: 'bearer', user: { id: me, email: 'test@example.invalid' },
    };
    await route.fulfill({ json: data });
  });
  await page.addInitScript(({ me }) => {
    localStorage.setItem('sb-127-papos-auth-token', JSON.stringify({
      access_token: btoa('{}') + '.' + btoa(JSON.stringify({ sub: me, exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature',
      refresh_token: 'test-only', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: me, email: 'test@example.invalid' },
    }));
  }, { me });
  await page.goto('/papos-app/calls');
  await expect(page.getByRole('heading', { name: 'Chamador de teste' })).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = '/src/integrations/supabase/client.ts';
    const { supabase } = await import(/* @vite-ignore */ modulePath);
    const remove = supabase.removeChannel.bind(supabase);
    // Model a delayed WebSocket leave acknowledgement using the real SDK.
    supabase.removeChannel = (channel: unknown) => new Promise(resolve => setTimeout(() => resolve(remove(channel)), 1000));
    const { error } = await supabase.auth.refreshSession();
    if (error) throw error;
  });
  // Allow auth callbacks and React effects to settle before checking the page.
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sb-127-papos-auth-token') || '{}').refresh_token)).toBe('renewed-test-only');
  await expect(page.getByRole('heading', { name: 'Chamador de teste' })).toBeVisible();
  ringing = false;
  await expect(page.getByRole('heading', { name: 'Chamador de teste' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByText('Não foi possível abrir esta página')).toHaveCount(0);
  await expect(page).toHaveURL(/\/papos-app\/calls$/);
  expect(errors).toEqual([]);
});
