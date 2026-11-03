import { test, expect } from "@playwright/test";
const me = "11111111-1111-4111-8111-111111111111",
  chat = "33333333-3333-4333-8333-333333333333";
const peers = Array.from(
  { length: 9 },
  (_, i) => `22222222-2222-4222-8222-${String(i + 1).padStart(12, "0")}`,
);
const profile = (id: string) => ({
  id,
  display_name: id === me ? "Teste local" : `Membro ${peers.indexOf(id) + 1}`,
  username: `membro${peers.indexOf(id) + 1}`,
  onboarding_completed: true,
  app_tour_completed: true,
  avatar_url: null,
});
async function setup(page: import("@playwright/test").Page) {
  await page.route("**/papos-app/**", async (route) =>
    route.request().isNavigationRequest()
      ? route.fulfill({
          response: await page.request.get("/papos-app/index.html"),
        })
      : route.continue(),
  );
  await page.route("**/127.0.0.1:54321/**", async (route) => {
    const url = new URL(route.request().url()),
      table = url.pathname.split("/").pop();
    let data: unknown = [];
    if (table === "user") data = { id: me, email: "test@example.invalid" };
    if (table === "profiles") data = profile(me);
    if (table === "public_profiles") data = [me, ...peers].map(profile);
    if (table === "get_public_profiles_by_ids")
      data = (route.request().postDataJSON()?.p_ids || []).map(profile);
    if (table === "conversation_participants")
      data = [me, ...peers].map((id) => ({
        conversation_id: chat,
        user_id: id,
        is_archived: false,
      }));
    if (table === "conversations")
      data = [
        {
          id: chat,
          type: "group",
          name: "Grupo de teste",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];
    if (table === "get_my_conversations")
      data = [
        {
          id: chat,
          type: "group",
          name: "Grupo de teste",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          participants: [me, ...peers].map((id) => ({
            user_id: id,
            profile: profile(id),
          })),
        },
      ];
    if (table === "recording_session") data = null;
    if (table === "group_conference_action")
      data = route.request().postDataJSON()?.p_action === "current" ? null : [];
    if (table === "contacts")
      data = peers.map((id) => ({
        id,
        contact_user_id: id,
        user_id: me,
        is_blocked: false,
        profile: profile(id),
      }));
    await route.fulfill({ json: data });
  });
  await page.addInitScript((me) => {
    localStorage.setItem("i18nextLng", "pt");
    localStorage.setItem(
      "sb-127-papos-auth-token",
      JSON.stringify({
        access_token:
          btoa("{}") +
          "." +
          btoa(
            JSON.stringify({
              sub: me,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ) +
          ".signature",
        refresh_token: "test-only",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: "bearer",
        user: { id: me, email: "test@example.invalid" },
      }),
    );
  }, me);
}
test("contacts exposes group creation without opening add-contact search", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/papos-app/contacts");
  await page.getByRole("button", { name: "Criar grupo", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Novo Grupo" })).toBeVisible();
  await expect(page.getByPlaceholder("Pesquisar contactos...")).toBeVisible();
});
test("group voice button selects multiple members and enforces seven invitees", async ({
  page,
}) => {
  await setup(page);
  await page.goto(`/papos-app/chat/${chat}`);
  await page
    .getByRole("button", { name: "Chamada de voz", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Participantes da conferência",
  });
  await expect(dialog).toBeVisible();
  const checkboxes = dialog.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(9);
  for (let i = 0; i < 7; i++) await checkboxes.nth(i).check();
  await expect(checkboxes.nth(7)).toBeDisabled();
  await expect(checkboxes.nth(8)).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Iniciar conferência" }),
  ).toBeEnabled();
  await checkboxes.nth(0).uncheck();
  await expect(checkboxes.nth(7)).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

// Exercise the real flex layout, including safe areas that Linux browsers lack.
async function safeAreas(page: import('@playwright/test').Page, insets: number[]) {
  await page.evaluate(insets => {
    const keys = ['top', 'right', 'bottom', 'left'];
    const rewrite = (rules: CSSRuleList): string => Array.from(rules).map(rule => {
      if (rule instanceof CSSStyleRule) {
        let css = rule.style.cssText;
        keys.forEach((key, i) => { css = css.replace(new RegExp(`env\\(safe-area-inset-${key}(?:,\\s*0px)?\\)`, 'g'), `${insets[i]}px`); });
        return `${rule.selectorText}{${css}}`;
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

for (const [width, height, insets] of [
  [320, 568, [0, 0, 0, 0]],
  [390, 844, [59, 0, 34, 0]],
  [412, 915, [24, 0, 24, 0]],
  [844, 390, [0, 59, 21, 0]],
  [844, 390, [0, 0, 21, 59]],
  [1280, 800, [0, 0, 0, 0]],
] as [number, number, number[]][]) {
  test(`group actions remain reachable at ${width}x${height} insets ${insets}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await setup(page);
    await page.goto('/papos-app/contacts');
    await page.getByRole('button', { name: 'Criar grupo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo Grupo', exact: true });
    await expect(dialog.getByPlaceholder('Pesquisar contactos...')).toBeVisible();
    await safeAreas(page, insets);
    const close = dialog.getByRole('button', { name: 'Fechar criação do grupo' });
    const next = dialog.getByRole('button', { name: /^Continuar ·/ });
    const reachable = async (control: import('@playwright/test').Locator, bottom = height) => {
      await expect.poll(() => control.evaluate((el, bounds) => {
        const box = el.getBoundingClientRect();
        return box.top >= bounds.top && box.left >= bounds.left && box.right <= bounds.right + 1 && box.bottom <= bounds.bottom + 1 && (el.matches(':disabled') || el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)));
      }, { top: insets[0], left: insets[3], right: width - insets[1], bottom: bottom - insets[2] })).toBe(true);
    };
    await reachable(close);
    await reachable(next);
    await expect(next).toBeDisabled();
    await dialog.getByRole('button', { name: /Membro 1 @membro1$/ }).click();
    await dialog.getByRole('button', { name: /Membro 2 @membro2$/ }).click();
    await expect(next).toHaveText('Continuar · 2 selecionados');
    await dialog.locator('[data-group-contact-list]').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await reachable(next);
    await reachable(close);
    await page.screenshot({ path: testInfo.outputPath('group-selection.png') });
    await next.click();
    await expect(dialog.getByRole('heading', { name: 'Detalhes do Grupo' })).toBeVisible();
    const create = dialog.getByRole('button', { name: 'Criar Grupo', exact: true });
    await expect(create).toBeDisabled();
    await dialog.getByLabel('Nome do grupo', { exact: true }).fill('Grupo de teste');
    await expect(create).toBeEnabled();
    await reachable(create);
    await reachable(close);
    if (width === 390) {
      // iOS keeps the layout viewport tall when its keyboard opens.
      await page.evaluate(() => {
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 420 });
        Object.defineProperty(window.visualViewport, 'offsetTop', { configurable: true, value: 0 });
        window.visualViewport!.dispatchEvent(new Event('resize'));
      });
      await reachable(create, 420);
      await reachable(close, 420);
      await reachable(dialog.getByLabel('Nome do grupo', { exact: true }), 420);
      await page.screenshot({ path: testInfo.outputPath('group-keyboard-open.png') });
      await page.evaluate(() => {
        (document.activeElement as HTMLElement)?.blur();
        Object.defineProperty(window.visualViewport, 'height', { configurable: true, value: 844 });
        window.visualViewport!.dispatchEvent(new Event('resize'));
      });
      await expect(dialog.getByText('Adicionar foto do grupo')).toBeVisible();
      await reachable(create);
    }
    await dialog.getByRole('button', { name: 'Voltar à seleção de contactos' }).click();
    await expect(next).toBeEnabled();
    await expect(next).toHaveText('Continuar · 2 selecionados');
    await close.click();
    await expect(dialog).toHaveCount(0);
  });
}
