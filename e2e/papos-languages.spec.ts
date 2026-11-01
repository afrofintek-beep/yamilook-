import { test, expect } from '@playwright/test';

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
    await expect(select.locator('option')).toHaveCount(13);
    await expect(select).toBeEnabled();
    await select.selectOption('fr');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('i18nextLng'))).toBe('fr');
    await page.reload();
    await expect(select).toHaveValue('fr');
    await expect(page.getByLabel('Mot de passe', { exact: true })).toBeVisible();
    for (const language of ['en','fr','pt','ar','am','sw','ln','yo','sn','zu','kmb','umb','kg']) {
      await select.selectOption(language);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await select.selectOption('yo');
    await expect(page.getByRole('button', { name: 'Wọle · KOSOLOLA' })).toBeVisible();
    await select.selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(select).toHaveValue('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await select.selectOption('pt');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('button', { name: 'Entrar na KOSOLOLA' })).toBeVisible();
  });
}
