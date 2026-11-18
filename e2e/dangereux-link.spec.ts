import { expect, test } from '@playwright/test';

test('the shared link and home-screen shortcut open the neighbourhood directly', async ({page}) => {
  await page.goto('/app/dangereux/');
  await expect(page.getByRole('heading', {name:'Dangereux', exact:true})).toBeVisible();
  const manifestUrl = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestUrl).toBe('/app/dangereux/manifest.webmanifest');
  const manifest = await (await page.request.get(manifestUrl!)).json();
  expect(manifest.start_url).toBe('/app/dangereux/');
  await page.getByRole('button',{name:'Encontrar uma padaria'}).click();
  await expect(page.getByRole('status')).toContainText('Padaria da Banda');
});

for (const signedIn of [false, true]) {
  test(`the main application opens an old neighbourhood link with signedIn=${signedIn}`, async ({page}) => {
    const key = 'sb-127-auth-token';
    if (signedIn) {
      await page.goto('/app/dangereux/');
      await page.evaluate(key => {
        const exp = Math.floor(Date.now() / 1000) + 86400;
        const sub = '11111111-1111-4111-8111-111111111111';
        const token = btoa('{}') + '.' + btoa(JSON.stringify({ sub, exp })) + '.test';
        localStorage.setItem(key, JSON.stringify({
          access_token: token, refresh_token: 'test-session', token_type: 'bearer',
          expires_at: exp, user: { id: sub, email: 'member@example.invalid' },
        }));
      }, key);
    }
    // Simulate the navigator receiving Yamilook's index.html from its old navigation cache.
    await page.route('**/dangereux/?*', async route => {
      const shell = await page.request.get('/index.html');
      await route.fulfill({response:shell});
    });
    await page.goto('/dangereux/?from=link#morador');
    await expect(page.getByRole('heading',{name:'Área do morador',exact:true})).toBeVisible();
    await expect(page).toHaveURL(/\/dangereux\/\?from=link#morador$/);
    await page.reload();
    await expect(page.getByRole('heading',{name:'Área do morador',exact:true})).toBeVisible();
    if (signedIn) expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').refresh_token, key)).toBe('test-session');
  });
}
