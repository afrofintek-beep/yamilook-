import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('encodes branded video with audible synchronized audio and renders text/photo cards', async ({ page }, testInfo) => {
  await page.goto('/tests/branded-export/harness.html');
  await page.getByRole('button', { name: 'Export synthetic fixture' }).click();
  await expect(page.locator('#status')).toHaveText(/^PASS /, { timeout: 90000 });
  const report = JSON.parse((await page.locator('#status').textContent()).slice(5));
  expect(report.cards).toBeGreaterThan(1); expect(report.image).toBeGreaterThan(1000);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download' }).click()]);
  const output = testInfo.outputPath(download.suggestedFilename()); await download.saveAs(output);
  const meta = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',output]).toString());
  const video = meta.streams.find(s => s.codec_type === 'video');
  const audio = meta.streams.find(s => s.codec_type === 'audio');
  expect(video.width).toBe(640); expect(video.height).toBeGreaterThan(360); expect(audio).toBeTruthy();
  expect(Math.abs(Number(meta.format.duration) - 3)).toBeLessThan(.25);
  const pcm = execFileSync('ffmpeg', ['-v','error','-i',output,'-f','f32le','-ac','1','-ar','48000','pipe:1']);
  let power = 0; for (let i=0;i<pcm.length;i+=4) power += pcm.readFloatLE(i)**2;
  expect(Math.sqrt(power/(pcm.length/4))).toBeGreaterThan(.03);
  const original = execFileSync('ffmpeg', ['-v','error','-i','tests/branded-export/fixture.mp4','-f','f32le','-ac','1','-ar','48000','pipe:1']);
  // Compatible AAC is copied; samples must stay identical (no silent/microphone substitute).
  if (audio.codec_name === 'aac') expect(Buffer.compare(pcm, original)).toBe(0);
  const still = testInfo.outputPath('branded-frame.png');
  execFileSync('ffmpeg', ['-v','error','-i',output,'-frames:v','1',still]);
  await testInfo.attach('branded-frame', {path:still,contentType:'image/png'});
  await testInfo.attach('branded-video', {path:output,contentType:report.type});
  await page.screenshot({ path: testInfo.outputPath('preview.png') });
});
