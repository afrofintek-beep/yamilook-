// Original, locally synthesised instrumentals; no external catalogue or artist recordings.
export const EDITOR_TRACKS = [
  { id: 'banda', name: 'Batida da Banda', bpm: 108, notes: [130.81, 155.56, 174.61, 155.56] },
  { id: 'brisa', name: 'Brisa', bpm: 90, notes: [164.81, 196, 220, 196] },
  { id: 'movimento', name: 'Movimento', bpm: 120, notes: [110, 130.81, 146.83, 130.81] },
] as const;

export function createInstrumental(context: AudioContext, id: string): AudioBuffer {
  const track = EDITOR_TRACKS.find(track => track.id === id);
  if (!track) throw new Error('Instrumental desconhecido');
  const beat = 60 / track.bpm;
  const buffer = context.createBuffer(1, Math.ceil(beat * 16 * context.sampleRate), context.sampleRate);
  const pcm = buffer.getChannelData(0);
  let noiseSeed = 73;
  for (let i = 0; i < pcm.length; i++) {
    const time = i / context.sampleRate;
    const step = Math.floor(time / (beat / 2));
    const t = time % (beat / 2);
    const note = track.notes[Math.floor(time / (beat * 4)) % 4];
    const bass = 0.18 * Math.sin(2 * Math.PI * note * t) * Math.exp(-t * 12) * Math.min(1, t * 300);
    const kick = step % 4 === 0 ? 0.32 * Math.sin(2 * Math.PI * (48 * t + 2 * (1 - Math.exp(-t * 30)))) * Math.exp(-t * 22) : 0;
    noiseSeed = (noiseSeed * 16807) % 2147483647;
    const noise = noiseSeed / 1073741823.5 - 1;
    const hat = noise * 0.07 * Math.exp(-t * 100) * Math.min(1, t * 1000);
    const clap = step % 8 === 4 ? noise * 0.12 * Math.exp(-t * 35) : 0;
    pcm[i] = bass + kick + hat + clap;
  }
  return buffer;
}

/** One graph for listening AND recording, so the exported mix matches the preview. */
export class VideoEditorAudio {
  readonly context: AudioContext;
  private original: MediaElementAudioSourceNode;
  private originalGain: GainNode;
  private musicGain: GainNode;
  private music: AudioBuffer | null = null;
  private playingMusic: AudioBufferSourceNode | null = null;
  private trimStart = 0;
  private sync = () => {
    this.stopMusic();
    if (!this.music || this.video.paused || this.video.seeking || this.video.ended) return;
    const source = this.context.createBufferSource();
    source.buffer = this.music;
    source.loop = true;
    source.connect(this.musicGain);
    source.start(0, Math.max(0, this.video.currentTime - this.trimStart) % this.music.duration);
    this.playingMusic = source;
  };
  private stopMusic = () => {
    this.playingMusic?.stop();
    this.playingMusic?.disconnect();
    this.playingMusic = null;
  };
  constructor(private video: HTMLVideoElement) {
    this.context = new AudioContext();
    this.original = this.context.createMediaElementSource(video);
    this.originalGain = this.context.createGain();
    this.musicGain = this.context.createGain();
    this.original.connect(this.originalGain);
    this.originalGain.connect(this.context.destination);
    this.musicGain.connect(this.context.destination);
    video.volume = 1; // Volume is applied exactly once, by the gain node (also on iOS).
    for (const event of ['playing', 'seeked']) video.addEventListener(event, this.sync);
    for (const event of ['pause', 'ended', 'seeking', 'waiting']) video.addEventListener(event, this.stopMusic);
  }
  resume() { return this.context.resume(); }
  setVolumes(original: number, music: number) {
    this.originalGain.gain.value = original / 100;
    this.musicGain.gain.value = music / 100;
  }
  setTrimStart(seconds: number) { this.trimStart = seconds; this.sync(); }
  setMusic(buffer: AudioBuffer | null) { this.music = buffer; this.sync(); }
  record() {
    const destination = this.context.createMediaStreamDestination();
    this.originalGain.connect(destination);
    this.musicGain.connect(destination);
    return { stream: destination.stream, disconnect: () => {
      this.originalGain.disconnect(destination);
      this.musicGain.disconnect(destination);
    } };
  }
  dispose() {
    this.stopMusic();
    for (const event of ['playing', 'seeked']) this.video.removeEventListener(event, this.sync);
    for (const event of ['pause', 'ended', 'seeking', 'waiting']) this.video.removeEventListener(event, this.stopMusic);
    this.original.disconnect(); this.originalGain.disconnect(); this.musicGain.disconnect();
    void this.context.close();
  }
}
