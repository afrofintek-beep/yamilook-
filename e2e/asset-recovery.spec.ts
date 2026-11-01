import { test, expect } from '@playwright/test';

const me = '11111111-1111-4111-8111-111111111111';
const authKey = 'sb-127-papos-auth-token';

test('recovers a stale lazy route in WebKit and preserves the existing login', async ({ page }) => {
  let navigations = 0;
  let invalidAssets = 0;
  let currentEntry = '';
  await page.route('**/papos-app/**', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    navigations++;
    const response = await page.request.get('/papos-app/index.html');
    let html = await response.text();
    currentEntry = html.match(/src="([^"]*\/papos-[^"]+\.js)"/)![1];
    if (navigations === 1) html = html.replace(currentEntry, '/assets/papos-stale.js');
    await route.fulfill({ response, body: html });
  });
  // The open app references an old hash; the refreshed shell references the new one.
  await page.route('**/assets/papos-stale.js', async route => {
    const response = await page.request.get(currentEntry);
    await route.fulfill({ response, body: (await response.text()).replace(/Calls-[\w-]+\.js/g, 'Calls-stale.js') });
  });
  await page.route('**/assets/Calls-stale.js', async route => {
    invalidAssets++;
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>New shell</body></html>' });
  });
  await page.route('**/127.0.0.1:54321/**', async route => {
    const table = new URL(route.request().url()).pathname.split('/').pop();
    let data: unknown = [];
    if (table === 'user') data = { id: me, email: 'test@example.invalid' };
    if (table === 'profiles') data = { id: me, display_name: 'Teste', onboarding_completed: true, app_tour_completed: true };
    if (table === 'call_participants') data = null;
    await route.fulfill({ json: data });
  });
  await page.addInitScript(({ me, authKey }) => {
    // Seed once; a reload must preserve this session itself.
    if (sessionStorage.getItem('test-session-seeded')) return;
    sessionStorage.setItem('test-session-seeded', 'true');
    localStorage.setItem(authKey, JSON.stringify({
      access_token: btoa('{}') + '.' + btoa(JSON.stringify({ sub: me, exp: Math.floor(Date.now() / 1000) + 3600 })) + '.signature',
      refresh_token: 'existing-test-session', expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: 'bearer', user: { id: me, email: 'test@example.invalid' },
    }));
  }, { me, authKey });

  await page.goto('/papos-app/calls');
  await expect.poll(() => navigations).toBe(2);
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await expect(page.getByText('Não foi possível abrir esta página')).toHaveCount(0);
  expect(invalidAssets).toBeGreaterThan(0);
  const state = await page.evaluate(authKey => ({
    session: JSON.parse(localStorage.getItem(authKey) || '{}'),
    diagnostic: JSON.parse(sessionStorage.getItem('kosolola-render-diagnostic-v1') || '{}'),
  }), authKey);
  expect(state.session.refresh_token).toBe('existing-test-session');
  expect(state.session.user.id).toBe(me);
  expect(state.diagnostic).toMatchObject({ category: 'asset-load', errorType: 'TypeError', hasStack: false });
  await expect(page).toHaveURL(/\/papos-app\/calls$/);
});
