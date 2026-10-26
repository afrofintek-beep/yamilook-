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
    if (table === 'user') data = { id: me, email: 'test@example.invalid' };
    if (table === 'profiles') data = profile(me);
    if (table === 'get_public_profiles_by_ids') data = [profile(me), profile(peer)];
    if (table === 'posts') data = Array.from({length: 12}, (_, i) => ({id: `post-${i}`, user_id: peer, type: i === 1 ? 'photo' : 'text', content: `Publicação ${i} ` + 'UmaPalavraMuitoLonga'.repeat(12), media_urls: i === 1 ? ['/yamilook-logo.png'] : [], privacy: 'everyone', likes_count: 0, comments_count: 0, shares_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString()}));
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


test('feed adapts across mobile, tablet, desktop and rotation without losing scroll access', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/muxi');
  await expect(page.locator('article').first()).toBeVisible();
  const nav = page.getByRole('navigation', {name: 'Navegação principal'});
  const main = page.locator('main');
  for (const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1280,height:800},{width:1440,height:900},{width:1920,height:1080},{width:390,height:844}]) {
    await page.setViewportSize(size);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const m = await main.boundingBox();
    const n = await nav.boundingBox();
    expect(m!.width).toBeLessThanOrEqual(680);
    expect(m!.x).toBeGreaterThanOrEqual(0);
    expect(m!.x + m!.width).toBeLessThanOrEqual(size.width);
    if (size.width >= 1024) {
      expect(n!.x + n!.width).toBeLessThanOrEqual(m!.x);
    } else {
      expect(Math.round(n!.y + n!.height)).toBe(size.height);
    }
    if (size.width >= 1280) await expect(page.getByRole('complementary', {name:'Na tua banda'})).toBeVisible();
    else await expect(page.getByRole('complementary', {name:'Na tua banda'})).toBeHidden();
    const viewport = page.locator('.feed-shell > [dir] > [data-radix-scroll-area-viewport]');
    await viewport.evaluate(el => {el.scrollTop = el.scrollHeight;});
    await expect(page.locator('article').last()).toBeInViewport();
    await expect(page.locator('header')).toBeInViewport();
    await viewport.evaluate(el => {el.scrollTop = 0;});
    if (size.width === 320 || size.width === 1440) await page.screenshot({path: test.info().outputPath(`feed-${size.width}.png`)});
  }
  await page.getByRole('button', {name: 'Criar publicação', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
