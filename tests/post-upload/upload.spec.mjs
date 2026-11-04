import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
const root = 'http://127.0.0.1:54321/storage/v1/upload/resumable';
let server, state;
test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const headers = {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST,PATCH,HEAD,OPTIONS',
      'Access-Control-Allow-Headers':req.headers['access-control-request-headers'] || 'authorization,apikey,x-upsert,tus-resumable,upload-offset,upload-length,upload-metadata,content-type',
      'Access-Control-Expose-Headers':'Location,Upload-Offset,Upload-Length,Tus-Resumable',
      'Tus-Resumable':'1.0.0',
    };
    const reply = (status, extra = {}) => { res.writeHead(status,{...headers,...extra}); res.end(); };
    if (req.method === 'OPTIONS') return reply(204);
    state.requests.push(req.method);
    if (req.headers.authorization !== 'Bearer fixture-token') state.errors.push('Missing fixture authorization');
    if (state.deny) { req.resume(); return reply(403); }
    if (req.method === 'HEAD') { state.heads++; return reply(200,{'Upload-Offset':String(state.offset),'Upload-Length':String(13*1024*1024)}); }
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    if (req.method === 'PATCH' && !state.failed) { state.failed = true; return reply(503); }
    if (body.length > 6*1024*1024 || !body.every(byte => byte === 7)) state.errors.push('Wrong chunk bytes');
    if (req.method === 'PATCH' && Number(req.headers['upload-offset']) !== state.offset) state.errors.push('Wrong resumed offset');
    state.sizes.push(body.length); state.offset += body.length;
    reply(req.method === 'POST' ? 201 : 204,{Location:root+'/fixture','Upload-Offset':String(state.offset)});
  });
  await new Promise(resolve => server.listen(54321,'127.0.0.1',resolve));
});
test.afterAll(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
test.beforeEach(() => { state={offset:0,failed:false,heads:0,sizes:[],requests:[],errors:[],deny:false}; });
test('uploads a large MOV in chunks and resumes at the confirmed offset after a failure', async ({ page }) => {
  await page.goto('/tests/post-upload/harness.html'); await page.getByText('Upload fixture').click();
  await expect(page.locator('#status')).toHaveText(/^(PASS|FAIL)/,{timeout:45000});
  expect(await page.locator('#status').textContent(),JSON.stringify(state)).toBe('PASS');
  expect(state.errors).toEqual([]); expect(state.failed).toBe(true); expect(state.heads).toBeGreaterThan(0);
  expect(state.sizes).toEqual([6*1024*1024,6*1024*1024,1024*1024]);
});
test('ends the upload on permission rejection without retrying or showing success', async ({ page }) => {
  state.deny=true;
  await page.goto('/tests/post-upload/harness.html'); await page.getByText('Upload fixture').click();
  await expect(page.locator('#status')).toContainText('FAIL Não foi possível autorizar');
  expect(state.requests).toEqual(['POST']);
});
