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

// WebKit on Linux has no iOS status bar/notch. Substitute env() declaration
// values in the actual loaded stylesheets to exercise asymmetric inset geometry.
async function simulateInsets(page: import('@playwright/test').Page, insets: number[]) {
  await page.evaluate(insets => {
    const keys = ['top','right','bottom','left'];
    const rewrite = (rules: CSSRuleList): string => Array.from(rules).map(rule => {
      if (rule instanceof CSSStyleRule) {
        let declarations = rule.style.cssText;
        keys.forEach((key, i) => { declarations = declarations.replace(new RegExp(`env\\(safe-area-inset-${key}(?:,\\s*0px)?\\)`, 'g'), `${insets[i]}px`); });
        return `${rule.selectorText}{${declarations}}`;
      }
      if (rule instanceof CSSMediaRule) return `@media ${rule.conditionText}{${rewrite(rule.cssRules)}}`;
      if (rule instanceof CSSSupportsRule) return `@supports ${rule.conditionText}{${rewrite(rule.cssRules)}}`;
      return rule.cssText;
    }).join('\n');
    const style = document.createElement('style');
    style.textContent = Array.from(document.styleSheets).map(sheet => { try { return rewrite(sheet.cssRules); } catch { return ''; } }).join('\n');
    document.head.append(style);
  }, insets);
}

test('KOSOLOLA shell stays fitted after scroll and rotation', async ({ page }) => {
  await mockAccount(page);
  await page.goto('/papos-app/papos');
  const header = page.locator('header');
  const nav = page.getByRole('navigation', { name: 'Navegação principal' });
  await expect(header).toBeVisible();
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    await page.evaluate(() => window.scrollTo(100, 200));
    await expect.poll(() => header.evaluate(el => el.getBoundingClientRect().top)).toBe(0);
    await expect.poll(() => nav.evaluate(el => Math.round(el.getBoundingClientRect().bottom))).toBe(size.height);
    expect(await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))).toEqual({ x: 0, y: 0 });
  }
});

test('KOSOLOLA fields avoid automatic focus zoom', async ({ page }) => {
  await page.route('**/papos-app/**', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const entry = await page.request.get('/papos-app/index.html');
    await route.fulfill({ response: entry });
  });
  await page.goto('/papos-app/login');
  const field = page.locator('input').first();
  await expect(field).toBeVisible();
  await field.focus();
  expect(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
  // Pinch zoom remains available for accessibility.
  await expect(page.locator('meta[name="viewport"]')).not.toHaveAttribute('content', /user-scalable=no|maximum-scale=1/);
});

for (const base of ['', '/papos-app']) {
  for (const [width,height,insets] of [
    [320,568,[0,0,0,0]], [375,667,[0,0,0,0]],
    [390,844,[0,0,0,0]], [390,844,[59,0,34,0]],
    [568,320,[0,0,0,0]], [1024,768,[0,0,0,0]],
    [844,390,[0,0,21,59]], [844,390,[0,59,21,0]],
  ] as [number,number,number[]][]) {
    test(`${base || 'Yamilook'} ${width}x${height} insets ${insets}`, async ({ page }) => {
      await page.setViewportSize({width,height});
      await mockAccount(page);
      await page.goto(`${base}/papos`);
      await expect(page.locator('header')).toBeVisible();
      await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute('content','black');
      await simulateInsets(page,insets);
      for (const button of await page.locator('header button').all()) {
        const box = await button.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(insets[3]);
        expect(box!.x+box!.width).toBeLessThanOrEqual(width-insets[1]+1);
        expect(box!.y).toBeGreaterThanOrEqual(insets[0]);
      }
      await page.goto(`${base}/chat/${chat}`);
      await expect(page.locator('.chat-page header h1')).toHaveText(name);
      await simulateInsets(page,insets);
      const buttons = page.locator('.chat-page header button');
      for (const button of await buttons.all()) {
        const box = await button.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(insets[3]);
        expect(box!.x+box!.width).toBeLessThanOrEqual(width-insets[1]+1);
        expect(box!.y).toBeGreaterThanOrEqual(insets[0]);
        expect(await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })).toBe(true);
      }
      await page.getByRole('button',{name:'Voltar',exact:true}).click();
      await expect(page).toHaveURL(new RegExp(`${base}/papos$`));
    });
  }
}

for (const [width,height,insets] of [
  [320,568,[0,0,0,0]], [375,667,[0,0,0,0]],
    [390,844,[0,0,0,0]], [390,844,[59,0,34,0]],
    [568,320,[0,0,0,0]], [1024,768,[0,0,0,0]],
  [844,390,[0,0,21,59]], [844,390,[0,59,21,0]],
] as [number,number,number[]][]) {
  test(`media ${width}x${height} insets ${insets}`, async ({ page }) => {
    await page.setViewportSize({width,height});
    await page.goto('/e2e/fixtures/media.html');
    await page.getByRole('button',{name:'Abrir media'}).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await simulateInsets(page,insets);
    await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const close = page.getByRole('button',{name:'Fechar pré-visualização'});
    const box = await close.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(insets[3]);
    expect(box!.x+box!.width).toBeLessThanOrEqual(width-insets[1]);
    expect(box!.y).toBeGreaterThanOrEqual(insets[0]);
    expect(box!.y+box!.height).toBeLessThanOrEqual(height-insets[2]);
    await close.click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button',{name:'Abrir media'}).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

for (const insets of [[0,0,21,59], [0,59,21,0]]) {
  test(`Yamilook feed landscape insets ${insets}`, async ({page}) => {
    await page.setViewportSize({width:844,height:390});
    await mockAccount(page);
    await page.goto('/muxi');
    await expect(page.locator('header')).toBeVisible();
    await simulateInsets(page,insets);
    for (const button of await page.locator('header button').all()) {
      const box = await button.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(insets[3]);
      expect(box!.x+box!.width).toBeLessThanOrEqual(844-insets[1]+1);
    }
  });
}

for (const [width, height, insets] of [
  [390, 844, [59, 0, 34, 0]],
  [844, 390, [0, 59, 21, 0]],
  [844, 390, [0, 0, 21, 59]],
  [320, 568, [0, 0, 0, 0]],
] as [number, number, number[]][]) {
  test(`archived chats close at ${width}x${height} insets ${insets}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockAccount(page);
    await page.route('**/rest/v1/conversations?**', route => route.fulfill({
      json: Array.from({ length: 30 }, (_, i) => ({
        id: i === 0 ? chat : `archive-${i}`, type: 'group',
        name: `Conversa arquivada ${i}`, updated_at: new Date().toISOString(),
      })),
    }));
    await page.goto('/papos-app/settings');
    await page.getByRole('button', { name: 'Conversas arquivadas', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Conversas Arquivadas' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Conversa arquivada 29', { exact: true })).toBeAttached();
    await simulateInsets(page, insets);
    await panel.evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
    const close = panel.getByRole('button', { name: 'Close', exact: true });
    const assertReachable = async () => {
      const box = await close.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(insets[0]);
      expect(box!.x).toBeGreaterThanOrEqual(insets[3]);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width - insets[1] + 1);
      expect(box!.y + box!.height).toBeLessThanOrEqual(height - insets[2]);
      expect(await close.evaluate(el => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })).toBe(true);
    };
    await assertReachable();
    await panel.locator('[data-radix-scroll-area-viewport]').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await assertReachable();
    await close.click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Conversas arquivadas', exact: true })).toBeVisible();
  });
}


test('KOSOLOLA switches between single pane and desktop split view', async ({ page }) => {
  await mockAccount(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/papos-app/chat/${chat}`);
  await expect(page.locator('.chat-page header h1')).toHaveText(name);
  await expect(page.locator('.kosolola-list')).toBeVisible();
  const list = await page.locator('.kosolola-list').boundingBox();
  const conversation = await page.locator('.chat-page').boundingBox();
  expect(conversation!.x).toBeGreaterThanOrEqual(list!.width - 1);
  expect(conversation!.x + conversation!.width).toBeLessThanOrEqual(1281);
  const draft = page.locator('textarea');
  await draft.fill('Rascunho preservado');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.kosolola-list')).toHaveCount(0);
  await expect(draft).toHaveValue('Rascunho preservado');
  await expect.poll(() => page.locator('.chat-page').evaluate(el => el.getBoundingClientRect().width)).toBe(390);
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.kosolola-list')).toBeVisible();
  await expect(draft).toHaveValue('Rascunho preservado');
});

test('KOSOLOLA composer follows keyboard viewport and restores after dismissal', async ({ page }) => {
  await mockAccount(page);
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 844, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/papos-app/chat/${chat}`);
  const draft = page.locator('textarea');
  await expect(draft).toBeVisible();
  for (const [height, top] of [[430, 30], [844, 0]]) {
    await page.evaluate(({ height, top }) => {
      Object.assign(window.visualViewport!, { height, offsetTop: top });
      window.visualViewport!.dispatchEvent(new Event('resize'));
    }, { height, top });
    await expect.poll(() => page.locator('.chat-page').evaluate(el => Math.round(el.getBoundingClientRect().bottom))).toBe(height + top);
    const box = await draft.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(height + top);
    expect(box!.y).toBeGreaterThanOrEqual(top);
  }
});

test('call chat, media and hangup occupy separate areas through keyboard resize', async ({ page }) => {
  await mockAccount(page);
  const callId = '44444444-4444-4444-8444-444444444444';
  await page.route('**/127.0.0.1:54321/rest/v1/calls*', route => route.fulfill({ json: new URL(route.request().url()).searchParams.has('id') ? {
    id: callId, type: 'video', initiator_id: me, caller_id: me, callee_id: peer,
    status: 'ongoing', is_group_call: false, conversation_id: chat,
  } : [] }));
  await page.route('**/127.0.0.1:54321/rest/v1/call_participants*', route => route.fulfill({ json:
    !new URL(route.request().url()).searchParams.has('call_id') ? [] : route.request().url().includes('role') ? { role: 'participant' } : [me, peer].map((id, index) => ({
      id: `participant-${index}`, user_id: id, is_muted: false, is_video_enabled: true,
      is_screen_sharing: false, is_hand_raised: false, is_spotlight: false,
    })),
  }));
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/papos-app/call/${callId}`);
  const layout = page.getByTestId('call-layout');
  const controls = page.getByTestId('call-controls');
  const chatPanel = page.getByRole('region', { name: 'Mensagens durante a chamada' });
  const composer = page.getByRole('textbox', { name: 'Escrever mensagem', exact: true });
  await expect(composer).toBeVisible();
  for (const size of [{ width: 390, height: 740 }, { width: 390, height: 430 }, { width: 844, height: 390 }, { width: 390, height: 740 }]) {
    await page.setViewportSize(size);
    await composer.fill('Continuo a escrever durante a chamada');
    const rectangles = await Promise.all([layout, controls, chatPanel, composer].map(locator => locator.boundingBox()));
    const [root, footer, panel, input] = rectangles;
    expect(root && footer && panel && input).toBeTruthy();
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(footer!.y + 1);
    expect(input!.y + input!.height).toBeLessThanOrEqual(footer!.y + 1);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(size.height + 1);
    const hangup = await page.getByRole('button', { name: 'Desligar chamada', exact: true }).boundingBox();
    expect(hangup!.y).toBeGreaterThanOrEqual(panel!.y + panel!.height - 1);
    await expect(composer).toHaveValue('Continuo a escrever durante a chamada');
  }
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/call-layout-mobile.png' });
});
