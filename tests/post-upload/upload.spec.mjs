import { test, expect } from '@playwright/test';
const root = 'http://127.0.0.1:54321/storage/v1/upload/resumable';
test('uploads a large MOV in chunks and resumes at the confirmed offset after a failure', async ({ page }) => {
  let offset = 0, failed = false, heads = 0;
  const sizes = [];
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Expose-Headers': 'Location,Upload-Offset,Tus-Resumable', 'Tus-Resumable': '1.0.0' };
  await page.route(root + '**', async route => {
    const request = route.request(), method = request.method();
    if (method === 'OPTIONS') return route.fulfill({ status:204, headers:{...headers,'Access-Control-Allow-Methods':'POST,PATCH,HEAD,OPTIONS','Access-Control-Allow-Headers':'*'} });
    expect(request.headers().authorization).toBe('Bearer fixture-token');
    if (method === 'HEAD') { heads++; return route.fulfill({ status:200, headers:{...headers,'Upload-Offset':String(offset),'Upload-Length':String(13*1024*1024)} }); }
    if (method === 'PATCH' && !failed) { failed = true; return route.fulfill({status:503,headers}); }
    const body = request.postDataBuffer(); expect(body.length).toBeLessThanOrEqual(6*1024*1024);
    expect(body.every(byte => byte === 7)).toBe(true);
    if (method === 'PATCH') expect(Number(request.headers()['upload-offset'])).toBe(offset);
    sizes.push(body.length); offset += body.length;
    return route.fulfill({ status:method === 'POST' ? 201 : 204, headers:{...headers,Location:root+'/fixture','Upload-Offset':String(offset)} });
  });
  await page.goto('/tests/post-upload/harness.html'); await page.getByText('Upload fixture').click();
  await expect(page.locator('#status')).toHaveText('PASS', { timeout:45000 });
  expect(failed).toBe(true); expect(heads).toBeGreaterThan(0); expect(sizes).toEqual([6*1024*1024,6*1024*1024,1024*1024]);
});
test('ends the upload on permission rejection without retrying or showing success', async ({ page }) => {
  let attempts = 0;
  await page.route(root + '**', async route => {
    attempts++;
    await route.fulfill({ status:403,headers:{'Access-Control-Allow-Origin':'*'},body:'Forbidden' });
  });
  await page.goto('/tests/post-upload/harness.html'); await page.getByText('Upload fixture').click();
  await expect(page.locator('#status')).toContainText('FAIL Não foi possível autorizar'); expect(attempts).toBe(1);
});
