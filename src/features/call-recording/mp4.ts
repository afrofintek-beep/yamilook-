import { ALL_FORMATS, BlobSource, StreamTarget, Conversion, Input, Mp4OutputFormat, Output, canEncodeAudio } from 'mediabunny';

let aacRegistration: Promise<void> | undefined;
/** Normalize actual media; never rename WebM bytes to MP4. Originals remain in storage. */
export async function prepareMp4(file: File, signal: AbortSignal, progress: (value: number) => void): Promise<File> {
  signal.throwIfAborted();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const video = await input.getPrimaryVideoTrack();
    // Voice calls stay audio files, without manufacturing a video track.
    if (!video) {
      const audio = await input.getPrimaryAudioTrack();
      if (!audio) throw new Error('missing_media');
      const mp4 = file.name.endsWith('.mp4');
      return new File([file], mp4 ? file.name.replace(/\.mp4$/, '.m4a') : file.name, { type: mp4 ? 'audio/mp4' : 'audio/webm' });
    }
    const audio = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('invalid_duration');
    const videoCodec = await video.getCodec();
    const audioCodec = await audio?.getCodec();
    signal.throwIfAborted();
    if (file.type === 'video/mp4' && videoCodec === 'avc' && (!audio || audioCodec === 'aac')) return file;
    // Bound browser memory; larger recordings can still be downloaded unchanged.
    if (file.size > 128 * 1024 * 1024 || duration > 1800) throw new Error('conversion_limit');
    if (audio && audioCodec !== 'aac' && !(await canEncodeAudio('aac'))) {
      aacRegistration ??= import('@mediabunny/aac-encoder').then(({ registerAacEncoder }) => registerAacEncoder());
      await aacRegistration;
    }
    signal.throwIfAborted();
    const chunks: { position: number; data: Uint8Array<ArrayBuffer> }[] = [];
    let size = 0, allocated = 0;
    const target = new StreamTarget(new WritableStream({ write(chunk) {
      signal.throwIfAborted();
      size = Math.max(size, chunk.position + chunk.data.byteLength);
      allocated += chunk.data.byteLength;
      if (size > 128 * 1024 * 1024 || allocated > 192 * 1024 * 1024) throw new Error('conversion_limit');
      chunks.push({ position: chunk.position, data: chunk.data.slice() });
    } }));
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'reserve' }), target });
    conversion = await Conversion.init({ input, output, tracks: 'primary', showWarnings: false,
      video: { codec: 'avc', bitrate: 2_000_000 }, audio: { codec: 'aac', bitrate: 128_000 } });
    if (!conversion.isValid || !conversion.utilizedTracks.includes(video) || (audio && !conversion.utilizedTracks.includes(audio))) throw new Error('unsupported_conversion');
    signal.throwIfAborted();
    conversion.onProgress = value => progress(Math.round(value * 100));
    await conversion.execute();
    signal.throwIfAborted();
    if (!size) throw new Error('empty_conversion');
    const bytes = new Uint8Array(size);
    for (const chunk of chunks) bytes.set(chunk.data, chunk.position);
    chunks.length = 0;
    const result = new File([bytes], file.name.replace(/\.[^.]+$/, '.mp4'), { type: 'video/mp4' });
    const check = new Input({ formats: ALL_FORMATS, source: new BlobSource(result) });
    try {
      const v = await check.getPrimaryVideoTrack(), a = await check.getPrimaryAudioTrack();
      if (!v || await v.getCodec() !== 'avc' || (audio && (!a || await a.getCodec() !== 'aac'))) throw new Error('missing_track');
      if (Math.abs(await check.computeDuration() - duration) > Math.max(1, duration * .02)) throw new Error('incomplete_conversion');
    } finally { check.dispose(); }
    return result;
  } finally {
    signal.removeEventListener('abort', cancel);
    if (conversion && conversion.state !== 'done') await conversion.cancel().catch(() => undefined);
    input.dispose();
  }
}
