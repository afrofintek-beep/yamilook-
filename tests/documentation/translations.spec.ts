import { test, expect } from '@playwright/test';

const languages = ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu'];
const guides = ['index', 'academia', 'audiencia', 'banda-lingua', 'lives', 'mokubico', 'momambos', 'muxi', 'papos'];

for (const language of languages) test(`manual, print presentation and mobile guides: ${language}`, async ({ page }, testInfo) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.addInitScript(() => { window.print = () => undefined; });
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [path, selector, count] of [['/manual/contas', '.print-page', 12], ['/apresentacao/pdf?print=0', '.print-slide', 16]] as const) {
    await page.goto(`${path}${path.includes('?') ? '&' : '?'}lang=${language}`);
    await expect(page.locator('.document-controls button')).toBeEnabled();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('html')).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator(selector)).toHaveCount(count);
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ path: testInfo.outputPath(`${selector.slice(1)}-${language}.pdf`), preferCSSPageSize: true, printBackground: true });
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBe(count);
    if (['ar', 'am', 'fr'].includes(language)) await page.screenshot({ path: testInfo.outputPath(`${selector.slice(1)}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const guide of guides) {
    await page.goto(`/guia/${guide}.html?lang=${language}`);
    await expect(page.locator('html')).toHaveAttribute('data-guide-ready', 'true');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('#guide-error')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (guide === 'academia' && ['ar', 'am', 'fr'].includes(language)) await page.screenshot({ path: testInfo.outputPath('academia-mobile.png'), fullPage: true });
  }
  await page.goto(`/manual/contas?lang=${language}`);
  await expect(page.locator('.document-controls button')).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
