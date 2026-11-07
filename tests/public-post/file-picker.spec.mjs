import { test, expect } from '@playwright/test';

test('file destinations retain the active gesture and LinkedIn offers an explicit handoff', async ({ page }) => {
  await page.addInitScript(() => {
    window.handoffs = [];
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: data => data.files?.length === 1 });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
      window.handoffs.push({ active: navigator.userActivation.isActive, name: data.files[0].name, type: data.files[0].type, keys: Object.keys(data) });
    } });
  });
  await page.goto('http://127.0.0.1:5173/tests/public-post/file-picker.html');
  const destinations = ['WhatsApp', 'LinkedIn', 'TikTok', 'YouTube', 'Facebook', 'Instagram', 'Outros'];
  for (const [index, name] of destinations.entries()) {
    await page.getByRole('button', { name, exact: true }).tap();
    if (name === 'LinkedIn') {
      // LinkedIn deliberately opens its preparation panel instead of the native share sheet.
      await expect(page.getByRole('region', { name: 'Publicar no LinkedIn' })).toBeVisible();
      expect(await page.evaluate(() => window.handoffs.length)).toBe(index);
      await expect(page.getByRole('link', { name: 'Abrir LinkedIn', exact: true })).toHaveAttribute('href', 'https://www.linkedin.com/feed/');
      await page.getByRole('button', { name: 'Tentar partilha pelo menu do telemóvel' }).tap();
    }
    await expect.poll(() => page.evaluate(() => window.handoffs.length)).toBe(index + 1);
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  const handoffs = await page.evaluate(() => window.handoffs);
  expect(handoffs.every(item => item.active && item.name === 'video-yamilook.mp4' && item.type === 'video/mp4')).toBe(true);
  expect(handoffs.every(item => item.keys.join() === 'files')).toBe(true);
  await expect(page.getByRole('button', { name: 'Abrir opções do telemóvel' })).toHaveCount(0);
});
