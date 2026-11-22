import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Local, harmless browser fixtures; no production requests or real malware.
test('application CSP baseline blocks active embeds and foreign base URLs', async t => {
  const templates = new Map(await Promise.all(['index.html', 'papos-app/index.html'].map(async path => {
    const html = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
    const meta = html.match(/<meta http-equiv="Content-Security-Policy"[^>]+>/)?.[0];
    assert.ok(meta, `Missing CSP baseline in ${path}`);
    return [`/${path}`, meta];
  })));
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (templates.has(req.url)) {
      res.end(`<!doctype html><head>${templates.get(req.url)}</head><body><script>window.booted = true;</script></body>`);
    } else res.end('<p>Permitted frame</p>');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  let browser;
  try {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
    browser = await chromium.launch({ executablePath, headless: true });
    const origin = `http://127.0.0.1:${server.address().port}`;
    for (const path of templates.keys()) {
      await t.test(path, async () => {
        const page = await browser.newPage();
        await page.goto(origin + path);
        assert.equal(await page.evaluate(() => window.booted), true);
        await page.evaluate(() => {
          window.violations = [];
          document.addEventListener('securitypolicyviolation', event => window.violations.push(event.effectiveDirective));
          const base = document.createElement('base');
          base.href = 'https://untrusted.invalid/';
          document.head.append(base);
          const object = document.createElement('object');
          object.type = 'text/html';
          object.data = '/blocked-object';
          document.body.append(object);
          const frame = document.createElement('iframe');
          frame.src = '/permitted-frame';
          document.body.append(frame);
        });
        await page.waitForFunction(() => window.violations.includes('object-src') && window.violations.includes('base-uri'));
        assert.equal(await page.evaluate(() => document.baseURI), origin + path);
        await page.locator('iframe').contentFrame().getByText('Permitted frame').waitFor();
        assert.ok(!requests.includes('/blocked-object'));
        await page.close();
      });
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
