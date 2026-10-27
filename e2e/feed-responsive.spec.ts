import { test, expect } from '@playwright/test';

const me = '11111111-1111-4111-8111-111111111111';
const peer = '22222222-2222-4222-8222-222222222222';
const chat = '33333333-3333-4333-8333-333333333333';
const name = 'Contacto com um nome muito longo para verificar os controlos';
const profile = (id: string) => ({ id, display_name: id === me ? 'Teste local' : name, username: 'teste', onboarding_completed: true, app_tour_completed: true, avatar_url: null });

// Synthetic API responses only. No real account or production writes.
async function mockAccount(page: import('@playwright/test').Page, paginate = false) {
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
    if (table === 'posts') data = Array.from({length: paginate ? (url.searchParams.has('created_at') ? 5 : 20) : 12}, (_, index) => { const i = index + (paginate && url.searchParams.has('created_at') ? 20 : 0); return ({id: `post-${i}`, user_id: peer, type: i === 1 ? 'photo' : 'text', content: `Publicação ${i} ` + 'UmaPalavraMuitoLonga'.repeat(12), media_urls: i === 1 ? ['/yamilook-logo.png'] : [], privacy: 'everyone', likes_count: 0, comments_count: 0, shares_count: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString()}); });
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


test('optional editors are not requested during feed startup, but open on demand', async ({ page }) => {
  await mockAccount(page);
  const optionalModules: string[] = [];
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (/(?:CreatePostSheet|CommentsSheet|EditPostSheet|ReportContentSheet)(?:[.-]|\/)/.test(path)) {
      // In test assertions only; never export request paths in the device report.
      optionalModules.push(path);
    }
  });
  await page.goto('/muxi');
  await expect(page.locator('article')).toHaveCount(12);
  await page.waitForLoadState('networkidle');
  expect(optionalModules).toEqual([]);
  await page.getByRole('button', { name: 'Criar publicação', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(optionalModules.some(name => name.includes('CreatePostSheet'))).toBe(true);
});

test('status viewer, status editor and sponsored-card code stays off the startup path', async ({ page }) => {
  await mockAccount(page);
  const requests: string[] = [];
  page.on('request', req => {
    const filename = new URL(req.url()).pathname.split('/').pop() || '';
    // Vite dev serves .tsx sources; production serves hashed .js chunks.
    if (/^(?:StatusViewer|CreateStatusSheet|SponsoredPostCard)(?:\.(?:tsx?|jsx?)|-[^.]+\.js)$/.test(filename)) {
      requests.push(filename);
    }
  });
  await page.goto('/muxi');
  await expect(page.locator('article')).toHaveCount(12);
  await expect(page.getByTestId('my-status')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requests).toEqual([]);
  await page.getByTestId('my-status').locator('button').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(requests.some(f => f.startsWith('CreateStatusSheet'))).toBe(true);
  expect(requests.some(f => f.startsWith('StatusViewer'))).toBe(false);
});

test('feed does not download full call history when only displaying publications', async ({ page }) => {
  let historyReads = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/call_participants'
      && url.searchParams.get('limit') === '50') historyReads++;
  });
  await mockAccount(page);
  await page.goto('/muxi');
  await expect(page.locator('article')).toHaveCount(12);
  await page.waitForLoadState('networkidle');
  expect(historyReads).toBe(0);
});

test('feed requests stay bounded as multiple posts mount', async ({ page }) => {
  let requests = 0;
  let discoveryRequests = 0;
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/rest/v1/posts') {
      requests++;
      if (url.searchParams.get('order') === 'likes_count.desc') discoveryRequests++;
    }
  });
  await mockAccount(page);
  await page.goto('/muxi');
  await expect(page.locator('article')).toHaveCount(12);
  await page.waitForLoadState('networkidle');
  console.log(`Post collection requests for 12 cards: ${requests}`);
  // React StrictMode mounts the single page owner twice in development;
  // each owner loads only the feed. Cards and closed sheets add none.
  expect(requests).toBeLessThanOrEqual(2);
  expect(discoveryRequests).toBe(0);
});

test('feed remains readable while advertisements are still loading', async ({ page }) => {
  await mockAccount(page);
  let releaseAds!: () => void;
  const pendingAds = new Promise<void>(resolve => { releaseAds = resolve; });
  let advertisingRequests = 0;
  await page.route('**/rest/v1/advertisements*', async route => {
    advertisingRequests++;
    await pendingAds;
    await route.fulfill({json: []});
  });
  try {
    await page.goto('/muxi');
    await expect(page.locator('article').first()).toBeVisible({timeout: 3000});
  } finally {
    releaseAds();
  }
  await page.waitForLoadState('networkidle');
  expect(advertisingRequests).toBe(1);
});

test('feed renders without waiting for slower reaction and bookmark metadata', async ({ page }) => {
  await mockAccount(page);
  let unblock!: () => void;
  const blocked = new Promise<void>(resolve => { unblock = resolve; });
  await page.route('**/rest/v1/post_likes*', async route => {
    await blocked;
    await route.fulfill({ json: [] });
  });
  await page.route('**/rest/v1/saved_posts*', async route => {
    await blocked;
    await route.fulfill({ json: [] });
  });
  try {
    await page.goto('/muxi');
    await expect(page.locator('article').first()).toBeVisible({timeout: 4000});
    await expect(page.locator('article')).toHaveCount(12);
  } finally {
    unblock();
  }
});

test('failed first page offers retry and recovers without a permanent loading spinner', async ({ page }) => {
  await mockAccount(page);
  let allowPosts = false;
  await page.route('**/rest/v1/posts*', async route => {
    if (allowPosts) return route.fallback();
    await route.fulfill({status: 400, json: {code: 'PGRST100', message: 'Simulated query failure'}});
  });
  await page.goto('/muxi');
  const error = page.getByRole('alert').filter({hasText: 'Não foi possível atualizar'});
  await expect(error).toBeVisible();
  allowPosts = true;
  await error.getByRole('button', {name: 'Repetir'}).click();
  await expect(page.locator('article')).toHaveCount(12);
  await expect(error).toHaveCount(0);
});

test('pagination error allows a manual retry without automatic request storms', async ({ page }) => {
  await mockAccount(page, true);
  let allowMore = false;
  let pageRequests = 0;
  await page.route('**/rest/v1/posts*', async route => {
    if (!new URL(route.request().url()).searchParams.has('created_at')) return route.fallback();
    pageRequests++;
    if (allowMore) return route.fallback();
    await route.fulfill({status: 400, json: {code: 'PGRST100', message: 'Simulated query failure'}});
  });
  await page.goto('/muxi');
  await expect(page.locator('article')).toHaveCount(20);
  await page.locator('.feed-scroll > [data-radix-scroll-area-viewport]').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const error = page.getByRole('alert').filter({hasText: 'Não foi possível carregar mais'});
  await expect(error).toBeVisible();
  expect(pageRequests).toBe(1);
  allowMore = true;
  await error.getByRole('button', {name: 'Repetir'}).click();
  await expect(page.locator('article')).toHaveCount(25);
});

for (const width of [390, 1440]) {
  test(`pagination appends once and stops at the final page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({width, height: 844});
    await mockAccount(page, true);
    let nextPages = 0;
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname === '/rest/v1/posts' && url.searchParams.has('created_at')) nextPages++;
    });
    await page.goto('/muxi');
    await expect(page.locator('article')).toHaveCount(20);
    const viewport = page.locator('.feed-scroll > [data-radix-scroll-area-viewport]');
    await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.locator('article')).toHaveCount(25);
    await viewport.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await expect(page.locator('article').last()).toBeInViewport();
    await page.waitForLoadState('networkidle');
    expect(nextPages).toBe(1);
  });
}


test('opt-in device report downloads sanitized timings without breaking mobile layout', async ({ page }) => {
  await page.setViewportSize({width: 390, height: 844});
  await mockAccount(page);
  await page.goto('/muxi');
  await expect(page.locator('article')).toHaveCount(12);
  await expect(page.getByRole('complementary', {name: 'Diagnóstico do feed'})).toHaveCount(0);
  await page.goto('/muxi?diagnostico=1');
  await expect(page.locator('article')).toHaveCount(12);
  await expect(page.getByRole('button', {name: 'Terminar recolha'})).toBeVisible();
  await page.getByRole('button', {name: 'Terminar recolha'}).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Guardar relatório'}).click();
  const download = await pending;
  const stream = await download.createReadStream();
  let raw = '';
  for await (const chunk of stream!) raw += chunk.toString();
  const report = JSON.parse(raw);
  expect(report.viewport.width).toBe(390);
  expect(report.version).toBe(3);
  expect(report.resourceCategories).toBeDefined();
  expect(report.resourcesByFiveSeconds).toBeDefined();
  expect(report.oversizedImageCount).toBeGreaterThanOrEqual(0);
  expect(report.imageDeliveryModes).toBeDefined();
  expect(Object.keys(report.imageDeliveryModes).sort()).toEqual(['fallback', 'original', 'unknown', 'variant']);
  expect(report.pixelRatio).toBeGreaterThan(0);
  expect(report.pendingImageCount).toBeGreaterThanOrEqual(0);
  expect(report.largestHundredMsBurst).toBeGreaterThanOrEqual(0);
  expect(report.peakHundredMsCategories).toBeDefined();
  expect(Object.values(report.peakHundredMsCategories).reduce((sum: number, n) => sum + Number(n), 0)).toBe(report.largestHundredMsBurst);
  expect(report.peakHundredMsStart).toBeGreaterThanOrEqual(0);
  expect(report.articles.atEnd).toBe(12);
  expect(report.firstArticleObservedMsAfterObserver).not.toBeNull();
  expect(report.resources.some((r: {category: string}) => r.category === 'api:posts')).toBe(true);
  expect(raw).not.toContain(me);
  expect(raw).not.toContain(peer);
  expect(raw).not.toContain('http');
  expect(raw).not.toContain('Publicação');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
