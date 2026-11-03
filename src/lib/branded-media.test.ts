import { expect, it } from 'vitest';
import { fitMedia, wrapText } from './branded-media';
it('fits portrait and landscape media without exceeding encoder bounds', () => {
  expect(fitMedia(1920, 1080)).toEqual({ width: 1280, height: 720 });
  expect(fitMedia(1080, 1920)).toEqual({ width: 720, height: 1280 });
  expect(() => fitMedia(0, 10)).toThrow();
});
it('retains long words, Unicode and paragraph boundaries across text cards', () => {
  const text = 'Cerimónia 🎉\n\nhttps://example.com/' + 'a'.repeat(120);
  const lines = wrapText(text, value => Array.from(value).length, 12);
  expect(lines.every(line => Array.from(line).length <= 12)).toBe(true);
  expect(lines.join('')).toBe(text.replaceAll('\n', ''));
  expect(lines).toContain('');
});
