import { test, expect } from '@playwright/test';
test('records both audio tracks and recovers the actual Blob after reload without exposing another account', async ({page}) => {
  await page.goto('/tests/call-recording/harness.html');
  test.skip(!await page.evaluate(() => typeof MediaRecorder !== 'undefined'), 'This Linux WebKit build has no MediaRecorder; physical Safari validation remains required.');
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await expect(page.getByText('recording',{exact:true})).toBeVisible();
  await page.waitForTimeout(2200);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await expect(page.getByText('saved',{exact:true})).toBeVisible();
  const result=await page.evaluate(()=>window.result);
  expect(result.type).toMatch(/^audio\//);expect(result.size).toBeGreaterThan(1000);
  expect(result.local).toBeGreaterThan(0.03);expect(result.remote).toBeGreaterThan(0.03);
  expect(result.noise).toBeLessThan(0.02);expect(result.running).toBe('running');expect(result.durable).toBe(true);
  await page.reload();await page.getByRole('button',{name:'Recover'}).click();
  await expect(page.getByText('recovered',{exact:true})).toBeVisible();
  const recovered=await page.evaluate(()=>window.recovery);
  expect(recovered).toEqual({count:1,size:result.size,other:0});
});

test('refuses capture without MediaRecorder rather than pretending to save',async({page})=>{
 await page.goto('/tests/call-recording/harness.html');
 await page.evaluate(()=>{Object.defineProperty(window,'MediaRecorder',{value:undefined,configurable:true});});
 await page.getByRole('button',{name:'Start',exact:true}).click();
 await expect(page.getByText('failed',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Stop',exact:true}).click();
 await expect(page.getByText('empty',{exact:true})).toBeVisible();
});
