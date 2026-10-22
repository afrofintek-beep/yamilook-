import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preparePostImage } from './post-image';
const drawImage = vi.fn();
let output: Blob | null;
class FakeImage {
  naturalWidth = 4000;
  naturalHeight = 3000;
  onload?: () => void;
  set src(_value: string) { queueMicrotask(() => this.onload?.()); }
}
beforeEach(() => {
  output = new Blob(['small'], { type: 'image/webp' });
  vi.stubGlobal('Image', FakeImage);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(output));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const photo = () => new File([new Uint8Array(500_000)], 'camera.jpg', { type: 'image/jpeg' });
describe('post image upload optimization', () => {
  it('resizes large camera images and matches the filename to the encoded type', async () => {
    const result = await preparePostImage(photo());
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 0, 0, 1600, 1200);
    expect(result.name).toBe('camera.webp');
    expect(result.size).toBeLessThan(500_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');
  });
  it('preserves animated GIF and small files', async () => {
    for (const file of [new File(['gif'], 'a.gif', { type: 'image/gif' }), new File(['small'], 'a.png', { type: 'image/png' })]) {
      expect(await preparePostImage(file)).toBe(file);
    }
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('keeps the original if encoding fails or increases the download size', async () => {
    const file = photo();
    output = null;
    expect(await preparePostImage(file)).toBe(file);
    output = new Blob([new Uint8Array(600_000)], { type: 'image/webp' });
    expect(await preparePostImage(file)).toBe(file);
  });
  it('supports browsers that encode PNG instead of WebP', async () => {
    output = new Blob(['png'], { type: 'image/png' });
    const result = await preparePostImage(photo());
    expect(result.name).toBe('camera.png');
    expect(result.type).toBe('image/png');
  });
});
