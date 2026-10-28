import { expect, it, vi } from 'vitest';
import type { Track } from 'livekit-client';
import { registerCallMedia, attachCallVideo } from './call-media';
vi.mock('./logger', () => ({ logger: { warn: vi.fn() } }));
it('a failed SDK attachment falls back instead of crashing the call page', () => {
  const stream = {} as MediaStream;
  const track = { kind: 'video', attach: vi.fn(() => { throw new Error('track disposed'); }) } as unknown as Track;
  registerCallMedia(stream, [track]);
  expect(attachCallVideo(stream, document.createElement('video'))).toBeNull();
});
it('cleanup tolerates an already disposed SDK track', () => {
  const stream = {} as MediaStream;
  const track = { kind: 'video', attach: vi.fn(), detach: vi.fn(() => { throw new Error('already detached'); }) } as unknown as Track;
  registerCallMedia(stream, [track]);
  const detach = attachCallVideo(stream, document.createElement('video'));
  expect(detach).not.toBeNull(); expect(() => detach!()).not.toThrow();
});
