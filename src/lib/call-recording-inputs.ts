/** Recording owns mixer nodes and preview elements, never the call's hardware tracks. */
export class CallRecordingInputs {
  private readonly allowedRemote: Set<string>;
  private readonly audio = new Map<MediaStreamTrack, MediaStreamAudioSourceNode>();
  private readonly video = new Map<MediaStreamTrack, HTMLVideoElement>();

  constructor(private readonly context: AudioContext, private readonly destination: MediaStreamAudioDestinationNode,
    remoteIds: Iterable<string>) {
    // Newly arriving participants need a new consent session; never capture them here.
    this.allowedRemote = new Set(remoteIds);
  }

  get videos() { return [...this.video.values()]; }

  sync(local: MediaStream | null, remote: Map<string, MediaStream>, localScreen: MediaStream | null = null,
    remoteScreens: Map<string, MediaStream> = new Map()) {
    const streams = [local, localScreen];
    for (const [id, stream] of remote) if (this.allowedRemote.has(id)) streams.push(stream);
    for (const [id, stream] of remoteScreens) if (this.allowedRemote.has(id)) streams.push(stream);
    const audio = new Set(streams.flatMap(s => s?.getAudioTracks() ?? []).filter(t => t.readyState !== 'ended'));
    const video = new Set(streams.flatMap(s => s?.getVideoTracks() ?? []).filter(t => t.readyState !== 'ended'));
    for (const [track, source] of this.audio) if (!audio.has(track)) {
      source.disconnect(); this.audio.delete(track);
    }
    for (const [track, element] of this.video) if (!video.has(track)) {
      element.pause(); element.srcObject = null; this.video.delete(track);
    }
    for (const track of audio) if (!this.audio.has(track)) {
      const source = this.context.createMediaStreamSource(new MediaStream([track]));
      this.audio.set(track, source);
      source.connect(this.destination);
    }
    for (const track of video) if (!this.video.has(track)) {
      const element = document.createElement('video');
      element.muted = true; element.playsInline = true;
      element.srcObject = new MediaStream([track]);
      this.video.set(track, element);
      void element.play().catch(() => {});
    }
  }

  dispose() {
    for (const source of this.audio.values()) source.disconnect();
    for (const element of this.video.values()) { element.pause(); element.srcObject = null; }
    this.audio.clear(); this.video.clear();
  }
}
