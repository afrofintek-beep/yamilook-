import { test, expect } from '@playwright/test';

const me = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const chat = '33333333-3333-4333-8333-333333333333';
const name = 'Contacto com um nome muito longo para verificar os controlos';
const profile = (id: string) => ({ id, display_name: id === me ? 'Teste local' : name, username: 'teste', onboarding_completed: true, app_tour_completed: true, avatar_url: null });

// Synthetic API responses only. No real account or production writes.
async function mockAccount(page: import('@playwright/test').Page) {
  // Match the production Vercel rewrite for the second HTML entry.
  await page.route('**/papos-app/**', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const entry = await page.request.get('/papos-app/index.html');
    await route.fulfill({ response: entry });
  });
  await page.route('**/127.0.0.1:54321/**', async route => {
    const url = new URL(route.request().url());
    const table = url.pathname.split('/').pop();
    let data: unknown = [];
    // The recording RPC returns a session object or null, never a table array.
    if (table === 'recording_session') data = null;
    if (table === 'user') data = { id: me, email: 'test@example.invalid' };
    if (table === 'profiles') data = profile(me);
    if (table === 'public_profiles') data = url.searchParams.get('id')?.startsWith('eq.') ? profile(peer) : [profile(me), profile(peer)];
    if (table === 'conversation_participants') data = [me, peer].map(id => ({ conversation_id: chat, user_id: id, is_archived: false }));
    if (table === 'conversations') data = [{ id: chat, type: 'direct', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
    await route.fulfill({ json: data });
  });
  await page.addInitScript(({ me }) => {
    const session = JSON.stringify({ access_token: btoa('{}')+'.'+btoa(JSON.stringify({sub:me,exp:Math.floor(Date.now()/1000)+3600}))+'.signature', refresh_token: 'test-only', expires_at: Math.floor(Date.now()/1000)+3600, token_type: 'bearer', user: { id: me, email: 'test@example.invalid' } });
    // Older client versions preserve an explicit undefined storageKey.
    localStorage.setItem('undefined', session);
    localStorage.setItem('sb-127-auth-token', session);
    localStorage.setItem('sb-127-papos-auth-token', session);
  }, { me });
}


for (const width of [320, 390]) {
  test(`settings translations fit and persist at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockAccount(page);
    await page.goto('/papos-app/settings');
    const selector = page.locator('select').first();
    await expect(selector).toBeEnabled();
    for (const lang of ['en', 'fr', 'ar', 'pt']) {
      await selector.selectOption(lang);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.locator('html')).toHaveAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const buttons = page.getByRole('button');
      for (const button of await buttons.all()) {
        if (await button.isVisible()) {
          expect(await button.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
        }
      }
    }
    await selector.selectOption('ar');
    await page.reload();
    await expect(selector).toHaveValue('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByRole('heading', { name: 'تنبيهات المكالمات' })).toBeVisible();
  });
}
