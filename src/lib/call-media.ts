import { logger } from './logger';
import type { Track } from 'livekit-client';

// Keep SDK tracks out of React state while preserving their attachment lifecycle.
// LiveKit adaptive video needs attach()/detach() to observe the visible element.
const sdkTracks = new WeakMap<MediaStream, readonly Track[]>();
export function registerCallMedia(stream: MediaStream, tracks: readonly Track[]) {
  sdkTracks.set(stream, tracks);
}
export function attachCallVideo(stream: MediaStream, element: HTMLVideoElement): (() => void) | null {
  const track = sdkTracks.get(stream)?.find(t => t.kind === 'video');
  if (!track) return null; // Existing WebRTC calls use plain MediaStreams.
  try {
    track.attach(element);
  } catch (error) {
    logger.warn('Video attachment failed; using the media stream', 'CallMedia', error);
    return null;
  }
  return () => {
    try { track.detach(element); }
    catch (error) { logger.warn('Video already detached', 'CallMedia', error); }
  };
}
