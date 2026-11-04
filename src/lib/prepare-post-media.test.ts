import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ brandVideo: vi.fn(), preparePostImage: vi.fn() }));
vi.mock('./branded-video', () => ({ brandVideo: mocks.brandVideo }));
vi.mock('./post-image', () => ({ preparePostImage: mocks.preparePostImage }));
import { preparePostMedia, POST_VIDEO_PREPARE_THRESHOLD } from './prepare-post-media';
beforeEach(() => { vi.clearAllMocks(); });
it('prepares the reported 398 MB MOV with audio-preserving conversion before upload', async () => {
  const source = new File(['fixture'], 'clip.MOV'); Object.defineProperty(source, 'size', { value: 398338993 });
  const converted = new File(['mp4'], 'video-yamilook.mp4', { type:'video/mp4' }); mocks.brandVideo.mockResolvedValue(converted);
  const progress = vi.fn(), signal = new AbortController().signal;
  expect(await preparePostMedia(source, signal, progress)).toBe(converted);
  expect(mocks.brandVideo).toHaveBeenCalledWith(source, null, signal, progress);
  expect(progress).toHaveBeenNthCalledWith(1, 0); expect(progress).toHaveBeenLastCalledWith(100);
});
it('keeps small videos unchanged and delegates photographs to the image optimiser', async () => {
  const small = new File(['video'], 'clip.mov'); const signal = new AbortController().signal;
  expect(await preparePostMedia(small, signal)).toBe(small); expect(mocks.brandVideo).not.toHaveBeenCalled();
  const photo = new File(['photo'], 'photo.jpg', {type:'image/jpeg'}); mocks.preparePostImage.mockResolvedValue(photo);
  expect(await preparePostMedia(photo, signal)).toBe(photo); expect(mocks.preparePostImage).toHaveBeenCalledWith(photo);
});
it('preserves cancellation and rejects a result that would still exceed the ceiling', async () => {
  const source = new File(['fixture'], 'clip.mp4'); Object.defineProperty(source, 'size', {value:POST_VIDEO_PREPARE_THRESHOLD+1});
  const controller = new AbortController(); controller.abort();
  await expect(preparePostMedia(source, controller.signal)).rejects.toMatchObject({name:'AbortError'}); expect(mocks.brandVideo).not.toHaveBeenCalled();
  mocks.brandVideo.mockResolvedValue(source);
  await expect(preparePostMedia(source, new AbortController().signal)).rejects.toThrow(/grande/);
});
