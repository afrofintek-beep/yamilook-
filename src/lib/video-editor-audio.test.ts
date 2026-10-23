import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { VideoEditorAudio, createInstrumental, EDITOR_TRACKS } from './video-editor-audio';
import { AudioContextMock } from '@/test/editor-audio-mock';
beforeEach(() => { AudioContextMock.instances = []; vi.stubGlobal('AudioContext', AudioContextMock); });
afterEach(() => vi.unstubAllGlobals());
describe('video music mix', () => {
  it('produces audible, bounded PCM for every instrumental', () => {
    const context = new AudioContextMock() as unknown as AudioContext;
    for (const track of EDITOR_TRACKS) {
      const pcm = createInstrumental(context, track.id).getChannelData(0);
      let peak = 0, energy = 0;
      for (const sample of pcm) { peak = Math.max(peak, Math.abs(sample)); energy += sample * sample; }
      expect(peak).toBeGreaterThan(0.1); expect(peak).toBeLessThan(1);
      expect(Math.sqrt(energy / pcm.length)).toBeGreaterThan(0.03);
    }
  });
  it('synchronises music with trim, seek and pause, and tears down on close', () => {
    const video = document.createElement('video');
    let paused = false;
    vi.spyOn(video, 'paused', 'get').mockImplementation(() => paused);
    video.currentTime = 7;
    const mixer = new VideoEditorAudio(video);
    const context = AudioContextMock.instances[0];
    mixer.setTrimStart(3); mixer.setMusic({ duration: 10 } as AudioBuffer);
    expect(context.sources[0].start).toHaveBeenCalledWith(0, 4);
    video.currentTime = 16; video.dispatchEvent(new Event('seeked'));
    expect(context.sources[0].stop).toHaveBeenCalled();
    expect(context.sources[1].start).toHaveBeenCalledWith(0, 3);
    paused = true; video.dispatchEvent(new Event('pause'));
    expect(context.sources[1].stop).toHaveBeenCalled();
    mixer.setMusic(null); paused = false; video.dispatchEvent(new Event('playing'));
    expect(context.sources).toHaveLength(2);
    mixer.dispose(); expect(context.close).toHaveBeenCalled();
  });
  it('applies each volume once and preserves preview connections after recording', () => {
    const video = document.createElement('video'); const mixer = new VideoEditorAudio(video);
    const context = AudioContextMock.instances[0]; mixer.setVolumes(50, 80);
    expect(video.volume).toBe(1); expect(context.gains.map(g => g.gain.value)).toEqual([0.5, 0.8]);
    const recording = mixer.record(); const destination = context.createMediaStreamDestination.mock.results[0].value;
    expect(recording.stream.getAudioTracks()).toHaveLength(1);
    recording.disconnect();
    for (const gain of context.gains) {
      expect(gain.connect).toHaveBeenCalledWith(context.destination);
      expect(gain.connect).toHaveBeenCalledWith(destination);
      expect(gain.disconnect).toHaveBeenCalledWith(destination);
    }
    expect(context.mediaSource.disconnect).not.toHaveBeenCalled(); mixer.dispose();
  });
});
