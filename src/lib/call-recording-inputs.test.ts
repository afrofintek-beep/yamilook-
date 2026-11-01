import { afterEach, expect, it, vi } from 'vitest';
import { CallRecordingInputs } from './call-recording-inputs';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup() {
  class Stream {
    constructor(public tracks: MediaStreamTrack[]) {}
    getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); }
    getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
  }
  vi.stubGlobal('MediaStream', Stream);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const nodes: { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const create = vi.fn(() => { const node = {connect: vi.fn(), disconnect: vi.fn()}; nodes.push(node); return node; });
  const inputs = new CallRecordingInputs({createMediaStreamSource: create} as unknown as AudioContext, {} as MediaStreamAudioDestinationNode, ['peer']);
  const track = (kind: string) => ({ kind, readyState: 'live', stop: vi.fn() }) as unknown as MediaStreamTrack;
  const stream = (...tracks: MediaStreamTrack[]) => new Stream(tracks) as unknown as MediaStream;
  return { inputs, create, nodes, track, stream };
}
it('replaces old inputs after reconnection without reconnecting unchanged microphone audio', () => {
  const {inputs, nodes, create, track, stream} = setup();
  const mic = track('audio'), oldAudio = track('audio'), oldVideo = track('video');
  inputs.sync(stream(mic), new Map([['peer', stream(oldAudio, oldVideo)]]));
  const oldElement = inputs.videos[0];
  const newAudio = track('audio'), newVideo = track('video');
  inputs.sync(stream(mic), new Map([['peer', stream(newAudio, newVideo)]]));
  expect(create).toHaveBeenCalledTimes(3);
  expect(nodes[0].disconnect).not.toHaveBeenCalled();
  expect(nodes[1].disconnect).toHaveBeenCalledOnce();
  expect(oldElement.srcObject).toBeNull();
  expect(inputs.videos).toHaveLength(1);
  expect(inputs.videos[0]).not.toBe(oldElement);
  inputs.dispose();
  expect(mic.stop).not.toHaveBeenCalled();
  expect(oldAudio.stop).not.toHaveBeenCalled();
  expect(newVideo.stop).not.toHaveBeenCalled();
});
it('adds unmuted audio and screen video, deduplicates tracks and excludes new participants', () => {
  const {inputs, create, nodes, track, stream} = setup();
  inputs.sync(null, new Map([['peer', stream()]]));
  const audio = track('audio'), screen = track('video'), stranger = track('audio');
  inputs.sync(stream(audio), new Map([['peer', stream(audio)], ['unconsented', stream(stranger)]]), null,
    new Map([['peer', stream(screen)], ['unconsented', stream(track('video'))]]));
  expect(create).toHaveBeenCalledTimes(1);
  expect(inputs.videos).toHaveLength(1);
  inputs.sync(null, new Map([['peer', stream()]]));
  expect(nodes[0].disconnect).toHaveBeenCalledOnce();
  expect(inputs.videos).toHaveLength(0);
});
