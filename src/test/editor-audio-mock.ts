import { vi } from 'vitest';
export class AudioNodeMock {
  connect = vi.fn(); disconnect = vi.fn(); gain = { value: 1 };
  start = vi.fn(); stop = vi.fn(); loop = false; buffer: AudioBuffer | null = null;
}
export class AudioContextMock {
  static instances: AudioContextMock[] = [];
  destination = new AudioNodeMock(); sampleRate = 8000;
  gains: AudioNodeMock[] = []; sources: AudioNodeMock[] = [];
  resume = vi.fn(async () => {}); close = vi.fn(async () => {});
  mediaSource = new AudioNodeMock();
  createMediaElementSource = vi.fn(() => this.mediaSource);
  createGain = vi.fn(() => { const gain = new AudioNodeMock(); this.gains.push(gain); return gain; });
  createBufferSource = vi.fn(() => { const source = new AudioNodeMock(); this.sources.push(source); return source; });
  createMediaStreamDestination = vi.fn(() => ({ stream: { getAudioTracks: () => [{ kind: 'audio', stop: vi.fn() }] } }));
  createBuffer = vi.fn((_channels: number, length: number, rate: number) => {
    const data = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => data } as unknown as AudioBuffer;
  });
  decodeAudioData = vi.fn(async () => this.createBuffer(1, 8000, 8000));
  constructor() { AudioContextMock.instances.push(this); }
}
