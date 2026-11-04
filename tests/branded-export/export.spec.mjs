import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

for (const format of ['mp4', 'webm', 'large', 'upload']) test(`encodes branded ${format} with audible synchronized audio and renders text/photo cards`, async ({ page }, testInfo) => {
  const mediaRequests = [];
  page.on('request', request => { if (request.url().endsWith('/large.webm')) mediaRequests.push(request); });
  await page.goto('/tests/branded-export/harness.html?format=' + (format === 'large' ? 'webm&large=1' : format === 'upload' ? 'mp4&upload=1' : format));
  if (format === 'upload') await page.locator('#source').setInputFiles('tests/branded-export/upload.mov');
  await page.getByRole('button', { name: 'Export synthetic fixture' }).click();
  await expect(page.locator('#status')).toHaveText(/^PASS /, { timeout: 90000 });
  const report = JSON.parse((await page.locator('#status').textContent()).slice(5));
  expect(report.type).toBe('video/mp4');
  if (format === 'upload') expect(report.video).toBeLessThan(48*1024*1024);
  if (format === 'large') { expect(mediaRequests.length).toBeGreaterThan(0); expect(mediaRequests.every(r => !!r.headers()['range'])).toBe(true); }
  expect(report.cards).toBeGreaterThan(1); expect(report.image).toBeGreaterThan(1000);
  const photo = page.locator('#photo');
  await expect(photo).toBeVisible();
  const pixels = await photo.evaluate(image => {
    const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let white = 0, gold = 0;
    for (let y = 270; y < 342; y++) for (let x = 32; x < 192; x++) {
      const i = (y * canvas.width + x) * 4, [r,g,b] = data.slice(i, i+3);
      if (r > 220 && g > 220 && b > 220) white++;
      if (r > 120 && g > 90 && b < 150 && r > g * 1.05 && g > b * 1.2) gold++;
    }
    return { width: canvas.width, height: canvas.height, white, gold, top: Array.from(data.slice(0, 3)) };
  });
  expect(pixels.width).toBe(640); expect(pixels.height).toBe(360);
  expect(pixels.white).toBeGreaterThan(100); expect(pixels.gold).toBeGreaterThan(10);
  pixels.top.forEach((value, i) => expect(Math.abs(value - [32,48,96][i])).toBeLessThan(4));
  await photo.screenshot({ path: testInfo.outputPath('branded-photo.png') });

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download' }).click()]);
  const output = testInfo.outputPath(download.suggestedFilename()); await download.saveAs(output);
  const bytes = readFileSync(output);
  const boxes = [];
  for (let i = 0; i < bytes.length;) { const size = bytes.readUInt32BE(i); const type = bytes.toString('ascii', i+4, i+8); boxes.push(type); i += size === 1 ? Number(bytes.readBigUInt64BE(i+8)) : size || bytes.length; }
  expect(boxes).toContain('moov'); expect(boxes).not.toContain('moof');
  expect(boxes.indexOf('moov')).toBeLessThan(boxes.indexOf('mdat'));
  const meta = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',output]).toString());
  const video = meta.streams.find(s => s.codec_type === 'video');
  const audio = meta.streams.find(s => s.codec_type === 'audio');
  expect(video.width).toBe(640); expect(video.height).toBe(360); expect(audio.codec_name).toBe('aac'); expect(video.codec_name).toBe('h264');
  expect(Math.abs(Number(meta.format.duration) - 3)).toBeLessThan(.25);
  const pcm = execFileSync('ffmpeg', ['-v','error','-i',output,'-f','f32le','-ac','1','-ar','48000','pipe:1']);
  let power = 0; for (let i=0;i<pcm.length;i+=4) power += pcm.readFloatLE(i)**2;
  expect(Math.sqrt(power/(pcm.length/4))).toBeGreaterThan(.03);
  const original = execFileSync('ffmpeg', ['-v','error','-i','tests/branded-export/fixture.' + (format === 'mp4' || format === 'upload' ? 'mp4' : 'webm'),'-f','f32le','-ac','1','-ar','48000','pipe:1']);
  // Compatible AAC is copied; samples must stay identical (no silent/microphone substitute).
  if (format === 'mp4' || format === 'upload') expect(Buffer.compare(pcm, original)).toBe(0);
  const still = testInfo.outputPath('branded-frame.png');
  execFileSync('ffmpeg', ['-v','error','-i',output,'-frames:v','1',still]);
  await testInfo.attach('branded-frame', {path:still,contentType:'image/png'});
  await testInfo.attach('branded-video', {path:output,contentType:report.type});
  await page.screenshot({ path: testInfo.outputPath('preview.png') });
});
