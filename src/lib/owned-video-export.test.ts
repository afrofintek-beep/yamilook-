import { beforeEach, expect, it, vi } from 'vitest';
import { prepareOwnedVideoExport } from './owned-video-export';
import { getOwnedMediaDescriptor } from './owned-post-media';
import { brandVideo } from './branded-video';
vi.mock('./owned-post-media', () => ({ getOwnedMediaDescriptor: vi.fn() }));
vi.mock('./branded-video', () => ({ brandVideo: vi.fn() }));
const source = { url: 'https://example.test/large.webm', type: 'video/webm', downloadUrl: '', filename: 'large.webm' };
const file = new File(['mp4'], 'video.mp4', { type: 'video/mp4' });
beforeEach(() => { vi.resetAllMocks(); vi.mocked(getOwnedMediaDescriptor).mockResolvedValue(source); vi.mocked(brandVideo).mockResolvedValue(file); });
it('passes a verified URL into bounded conversion and revalidates before release', async () => {
  const signal = new AbortController().signal;
  expect(await prepareOwnedVideoExport('id', 0, { signal })).toBe(file);
  expect(brandVideo).toHaveBeenCalledWith(source.url, null, signal, expect.any(Function));
  expect(getOwnedMediaDescriptor).toHaveBeenCalledTimes(2);
});
it('never converts on denied authorization and discards output if revoked afterwards', async () => {
  vi.mocked(getOwnedMediaDescriptor).mockRejectedValueOnce(new Error('denied'));
  await expect(prepareOwnedVideoExport('id', 0, { signal: new AbortController().signal })).rejects.toThrow('denied');
  expect(brandVideo).not.toHaveBeenCalled();
  vi.mocked(getOwnedMediaDescriptor).mockResolvedValueOnce(source).mockRejectedValueOnce(new Error('revoked'));
  await expect(prepareOwnedVideoExport('id', 0, { signal: new AbortController().signal })).rejects.toThrow('revoked');
});
it('discards conversion if the selected media changed', async () => {
  vi.mocked(getOwnedMediaDescriptor).mockResolvedValueOnce(source).mockResolvedValueOnce({ ...source, url: source.url+'?changed' });
  await expect(prepareOwnedVideoExport('id', 0, { signal: new AbortController().signal })).rejects.toThrow('mudou');
});
