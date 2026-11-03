import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ init: vi.fn(), dispose: vi.fn(), cancel: vi.fn(), video: { displayWidth: 640, displayHeight: 360 }, audio: { getCodec: async () => 'aac' } }));
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], BlobSource: class {}, Input: class { getPrimaryVideoTrack = async () => mocks.video; getPrimaryAudioTrack = async () => mocks.audio; computeDuration = async () => 3; dispose = mocks.dispose; },
  Output: class {}, Mp4OutputFormat: class {}, WebMOutputFormat: class {}, StreamTarget: class {}, Quality: class {},
  canEncodeVideo: async () => true, canEncodeAudio: async () => true, Conversion: { init: mocks.init },
}));
vi.mock('./branded-media', () => ({ fitMedia: () => ({ width: 640, height: 360 }), loadBrandLogo: async () => ({ close: vi.fn() }), drawBrand: vi.fn(), EXPORT_LIMIT: 104857600 }));
import { brandVideo } from './branded-video';
const identity = { content: '', author: { name: 'Author', username: 'author' } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as CanvasRenderingContext2D);
  mocks.cancel.mockResolvedValue(undefined);
});
it('refuses a conversion that drops the audio track even if a video-only result is valid', async () => {
  const execute = vi.fn();
  mocks.init.mockResolvedValue({ isValid: true, utilizedTracks: [mocks.video], state: 'idle', cancel: mocks.cancel, execute });
  await expect(brandVideo(new File(['video'], 'a.mp4'), identity, new AbortController().signal, vi.fn())).rejects.toThrow(/áudio/);
  expect(execute).not.toHaveBeenCalled(); expect(mocks.cancel).toHaveBeenCalled(); expect(mocks.dispose).toHaveBeenCalled();
});
it('does no processing for an already cancelled operation', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(brandVideo(new File([], 'a.mp4'), identity, controller.signal, vi.fn())).rejects.toMatchObject({ name: 'AbortError' });
  expect(mocks.init).not.toHaveBeenCalled();
});
