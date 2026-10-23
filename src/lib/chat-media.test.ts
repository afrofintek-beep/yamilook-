import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatMediaContentType, chatMediaType, createVideoPoster, mediaCaption, videoThumbnailSource } from './chat-media';

describe('chat media classification and captions', () => {
  it('recognizes iPhone MOV files even when the picker omits the MIME type', () => {
    expect(chatMediaType({ name: 'clip.MOV', type: '' })).toBe('video');
    expect(chatMediaContentType({ name: 'clip.MOV', type: '' })).toBe('video/quicktime');
    expect(chatMediaType({ name: 'clip.mp4', type: 'application/octet-stream' })).toBe('video');
    expect(chatMediaType({ name: 'document.pdf', type: 'application/pdf' })).toBe('file');
  });

  it('hides stored filenames without removing real captions', () => {
    const url = 'https://example.com/media/user/123_d21b6a8d.mov?token=example';
    expect(mediaCaption('d21b6a8d.mov', url)).toBeNull();
    expect(mediaCaption('Olá banda', url)).toBe('Olá banda');
    expect(mediaCaption('Férias 2026.mov', 'https://example.com/123_F%C3%A9rias%202026.mov')).toBeNull();
  });

  it('requests a nonzero frame without modifying signatures or existing fragments', () => {
    expect(videoThumbnailSource('https://example.com/clip.mov?token=x')).toBe('https://example.com/clip.mov?token=x#t=0.1');
    expect(videoThumbnailSource('https://example.com/clip.mov#t=4')).toBe('https://example.com/clip.mov#t=4');
  });
});

describe('local video covers', () => {
  let video: HTMLVideoElement;
  let drawImage: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => {
      const element = createElement(tag, options);
      if (tag === 'video') video = element as HTMLVideoElement;
      return element;
    }) as typeof document.createElement);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:local-video'), revokeObjectURL: vi.fn() }));
    drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['jpeg'], { type: 'image/jpeg' })));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('creates a small JPEG with duration and releases the local video URL', async () => {
    const pending = createVideoPoster(new File(['clip'], 'clip.mov', { type: 'video/quicktime' }));
    Object.defineProperties(video, {
      readyState: { value: 2 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 }, duration: { value: 16.75 },
    });
    video.dispatchEvent(new Event('loadedmetadata'));
    video.dispatchEvent(new Event('seeked'));
    const result = await pending;
    expect(result?.blob.type).toBe('image/jpeg');
    expect(result?.durationSeconds).toBe(17);
    expect(drawImage).toHaveBeenCalledWith(video, 0, 0, 480, 270);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-video');
    expect(video).not.toHaveAttribute('src');
  });

  it('releases the video and resolves without a cover when decoding fails', async () => {
    const pending = createVideoPoster(new File(['broken'], 'broken.mov'));
    video.dispatchEvent(new Event('error'));
    expect(await pending).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });

  it('times out an unsupported preview without preventing the original upload', async () => {
    vi.useFakeTimers();
    const pending = createVideoPoster(new File(['clip'], 'clip.mov'));
    vi.advanceTimersByTime(6000);
    expect(await pending).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
  });
});
