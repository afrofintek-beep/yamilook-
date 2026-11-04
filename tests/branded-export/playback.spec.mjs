import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';

test('native playback fallback exports a branded playable MP4 with audible original soundtrack', async ({ page }, testInfo) => {
  const source = process.env.YAMILOOK_DECODER_SOURCE || '/tests/branded-export/fixture.mp4';
  await page.goto('/tests/branded-export/playback.html?source=' + encodeURIComponent(source));
  await expect.poll(() => page.locator('#source').evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  const duration = await page.locator('#source').evaluate(video => video.duration);
  expect(await page.evaluate(() => window.compatibleSupported)).toBe(true);
  // No getUserMedia is permitted: the soundtrack must come from the original media.
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => { throw new Error('Unexpected microphone access'); }; });
  await page.getByRole('button', { name: 'Prepare compatible copy' }).click();
  await expect(page.locator('#status')).toHaveText('PASS', { timeout: 90000 });
  await page.locator('#preview').evaluate(video => { video.muted = true; return video.play(); });
  await expect.poll(() => page.locator('#preview').evaluate(video => video.currentTime)).toBeGreaterThan(.1);
  const brand = await page.locator('#preview').evaluate(video => {
    const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let gold = 0, white = 0;
    for (let y = Math.floor(canvas.height * .8); y < canvas.height; y++) for (let x = 0; x < canvas.width * .35; x++) {
      const i = (y * canvas.width + x) * 4; const [r,g,b] = pixels.slice(i,i+3);
      if (r > 220 && g > 220 && b > 220) white++;
      if (r > 120 && g > 90 && b < 150 && r > g * 1.05 && g > b * 1.2) gold++;
    }
    return { gold, white };
  });
  expect(brand.gold).toBeGreaterThan(10); expect(brand.white).toBeGreaterThan(100);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download' }).click()]);
  const output = testInfo.outputPath('compatible.mp4'); await download.saveAs(output);
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',output]).toString());
  expect(metadata.streams.find(stream => stream.codec_type === 'video').codec_name).toBe('h264');
  expect(metadata.streams.find(stream => stream.codec_type === 'audio').codec_name).toBe('aac');
  expect(Math.abs(Number(metadata.format.duration) - duration)).toBeLessThan(1);
  const pcm = execFileSync('ffmpeg', ['-v','error','-i',output,'-f','f32le','-ac','1','-ar','48000','pipe:1'], {maxBuffer: 32 * 1024 * 1024});
  let power = 0; for (let i=0;i<pcm.length;i+=4) power += pcm.readFloatLE(i)**2;
  expect(Math.sqrt(power/(pcm.length/4))).toBeGreaterThan(.005);
  const frame = testInfo.outputPath('compatible.png'); execFileSync('ffmpeg', ['-v','error','-i',output,'-frames:v','1',frame]);
  await testInfo.attach('compatible-frame', {path:frame,contentType:'image/png'});
  await testInfo.attach('compatible-video', {path:output,contentType:'video/mp4'});
});

test('native playback cancellation never exposes a partial file', async ({ page }) => {
  await page.goto('/tests/branded-export/playback.html');
  await expect.poll(() => page.locator('#source').evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);
  await page.getByRole('button', { name: 'Prepare compatible copy' }).click();
  await expect(page.locator('#status')).toContainText('Preparing');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#status')).toHaveText('CANCELLED');
  await expect(page.locator('#download')).not.toHaveAttribute('href');
});
