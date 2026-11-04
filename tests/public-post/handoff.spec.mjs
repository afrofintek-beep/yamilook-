import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { renderPublicPost } from '../../server/public-post-page.mjs';

const id = 'b2b884db-8edc-4acd-8739-07a32eee320a';
const url = `https://www.yamilook.com/post/${id}`;
const html = renderPublicPost({ id, author: { display_name: 'Tony' }, content: 'Vídeo de teste', created_at: '2026-11-04', media_urls: ['https://example.test/video.mp4'] });

test('mobile LinkedIn chooser keeps manual recovery available and never claims publication', async ({ page }) => {
  await page.addInitScript(() => {
    window.testShares = [];
    Object.defineProperty(navigator, 'share', { configurable: true, value: async payload => { window.testShares.push(payload); } });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.testCopied = value; } } });
  });
  await page.route('**/*', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === `/post/${id}`) return route.fulfill({ contentType: 'text/html', body: html });
    if (path === '/public-post-share.js') return route.fulfill({ contentType: 'text/javascript', body: readFileSync(new URL('../../public/public-post-share.js', import.meta.url), 'utf8') });
    if (path === '/public-post.css') return route.fulfill({ contentType: 'text/css', body: readFileSync(new URL('../../public/public-post.css', import.meta.url), 'utf8') });
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(url);
  await page.getByRole('button', { name: 'Partilhar', exact: true }).click();
  await page.locator('summary', { hasText: 'LinkedIn' }).click();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('button', { name: 'Preparar vídeo para LinkedIn' })).toBeVisible();
  await page.getByRole('button', { name: 'Copiar ligação para LinkedIn' }).click();
  await expect.poll(() => page.evaluate(() => window.testCopied)).toBe(url);
  await expect(page.locator('#dialog-share-status')).toContainText('Abre a aplicação LinkedIn');
  await page.getByRole('button', { name: 'Partilhar ligação pelas opções do telemóvel' }).click();
  await expect.poll(() => page.evaluate(() => window.testShares.length)).toBe(1);
  await expect(page.locator('#dialog-share-status')).toContainText('não recebe confirmação de publicação');
  await page.getByRole('button', { name: 'Preparar vídeo para LinkedIn' }).click();
  await expect(page.locator('#prepare-video')).toBeFocused();
  await expect(page.locator('#share-destinations')).toBeVisible();
});
