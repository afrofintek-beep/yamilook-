import { test, expect } from '@playwright/test';

test('long text expands in one scrolling editor and saves the complete text', async ({ page }) => {
 await page.goto('/tests/post-editor/harness.html');
 const field = page.getByLabel('Texto da publicação');
 await expect(field).toBeVisible();
 const text = Array.from({ length: 18 }, (_, i) => `Parágrafo ${i + 1}: encontrar a casa, a loja e o serviço na nossa comunidade.`).join('\n\n');
 await field.fill(text);
 await expect.poll(() => field.evaluate(el => el.scrollHeight <= el.clientHeight + 2)).toBe(true);
 const scroll = page.getByTestId('edit-post-scroll');
 expect(await scroll.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
 await scroll.evaluate(el => { el.scrollTop = el.scrollHeight; });
 await expect(page.getByRole('button', { name: 'Guardar', exact: true })).toBeInViewport();
 await page.getByLabel('Adicionar local').fill('');
 await page.getByRole('combobox').click();
 await page.getByRole('option', { name: 'Só Eu', exact: true }).click();
 await page.getByRole('button', { name: 'Guardar', exact: true }).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 const saved = JSON.parse(await page.locator('output').textContent() || '{}');
 expect(saved).toEqual({ content: text, location: '', privacy: 'only_me' });
});

test('adapts to a reduced visual viewport, preserves text, and confirms cancellation', async ({ page }) => {
 await page.addInitScript(() => {
   const viewport = new EventTarget();
   Object.assign(viewport, { width: 393, height: 852, offsetTop: 0, scale: 1 });
   Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport });
 });
 await page.goto('/tests/post-editor/harness.html');
 const field = page.getByLabel('Texto da publicação');
 await field.fill('Texto que não deve desaparecer.');
 await page.evaluate(() => {
   Object.assign(window.visualViewport!, { height: 370 });
   window.visualViewport!.dispatchEvent(new Event('resize'));
 });
 await expect.poll(async () => (await page.getByRole('dialog').boundingBox())!.height).toBeLessThan(371);
 const save = await page.getByRole('button', { name: 'Guardar', exact: true }).boundingBox();
 expect(save!.y).toBeGreaterThanOrEqual(0);
 expect(save!.y + save!.height).toBeLessThanOrEqual(370);
 await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
 await page.getByRole('button', { name: 'Continuar a editar' }).click();
 await expect(field).toHaveValue('Texto que não deve desaparecer.');
});

test('fits narrow, desktop and Arabic layouts without horizontal overflow', async ({ page }, testInfo) => {
 for (const [width, height, lang] of [[320, 568, 'pt'], [1440, 900, 'pt'], [393, 852, 'ar']] as const) {
   await page.setViewportSize({ width, height });
   await page.goto(`/tests/post-editor/harness.html?lang=${lang}`);
   const dialog = page.getByRole('dialog');
   await expect(dialog).toBeVisible();
   await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
   const field = dialog.locator('textarea');
   expect((await field.boundingBox())!.height).toBeGreaterThan(180);
   await page.screenshot({ path: testInfo.outputPath(`editor-${width}-${lang}.png`) });
   if (lang === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
 }
});

test('shows the editor controls in all ten application languages', async ({ page }) => {
 for (const lang of ['pt', 'en', 'fr', 'ar', 'am', 'sw', 'ln', 'yo', 'sn', 'zu']) {
   await page.goto(`/tests/post-editor/harness.html?lang=${lang}`);
   const dialog = page.getByRole('dialog');
   await expect(dialog).toBeVisible();
   await expect(dialog).not.toContainText(/feed\.|status\.|common\./);
   expect(await dialog.locator('textarea').getAttribute('id')).toBeTruthy();
   await expect.poll(() => dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
 }
});
