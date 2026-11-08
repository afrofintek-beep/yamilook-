import { test, expect } from '@playwright/test';

const slogans: Record<string, string> = {
  pt: 'A conversa é nossa.', en: 'The conversation is ours.',
  fr: 'La conversation est à nous.', ar: 'المحادثة لنا.',
  am: 'ውይይቱ የእኛ ነው።', sw: 'Mazungumzo ni yetu.',
  ln: 'Lisolo ezali ya biso.', yo: 'Ìjíròrò náà jẹ́ tiwa.',
  sn: 'Hurukuro ndeyedu.', zu: 'Ingxoxo ingeyethu.',
};

for (const width of [320, 390]) {
  test(`AFROLOC languages persist and fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/papos-app/**', async route => {
      if (!route.request().isNavigationRequest()) return route.continue();
      const entry = await page.request.get('/papos-app/index.html');
      await route.fulfill({ response: entry });
    });
    await page.route('**/127.0.0.1:54321/**', route => route.fulfill({ json: [] }));
    await page.goto('/papos-app/login');
    const select = page.getByRole('combobox');
    await expect(select.locator('option')).toHaveCount(10);
    // The public rollout excludes languages still awaiting linguistic review.
    await expect(select.locator('option[value="kmb"], option[value="umb"], option[value="kg"]')).toHaveCount(0);
    await expect(select).toBeEnabled();
    await select.selectOption('fr');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('i18nextLng'))).toBe('fr');
    await page.reload();
    await expect(select).toHaveValue('fr');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
    await select.selectOption('yo');
    await expect(page.getByRole('button', { name: 'Wọle · KOSOLOLA' })).toBeVisible();
    await select.selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await select.selectOption('pt');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('button', { name: 'Entrar na KOSOLOLA' })).toBeVisible();
    for (const language of ['en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu', 'pt']) {
      await select.selectOption(language);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.getByRole('heading', { level: 1 })).toHaveAttribute('lang', language);
      await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
      await expect(page.getByText(slogans[language], { exact: true })).toBeVisible();
      if (language !== 'pt') await expect(page.getByText(slogans.pt, { exact: true })).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
