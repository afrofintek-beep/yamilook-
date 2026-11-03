import { ALL_FORMATS, BlobSource, Conversion, Input, Output, Mp4OutputFormat, WebMOutputFormat, StreamTarget, canEncodeVideo, canEncodeAudio, Quality } from 'mediabunny';
import type { ExportIdentity } from './owned-post-media';
import { drawBrand, EXPORT_LIMIT, fitMedia, loadBrandLogo } from './branded-media';

export async function brandVideo(file: File, identity: ExportIdentity, signal: AbortSignal, onProgress: (progress: number) => void): Promise<File> {
  signal.throwIfAborted();
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  let logo: ImageBitmap | undefined;
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error('O ficheiro não contém uma pista de vídeo.');
    const audio = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error('A cópia com marca suporta vídeos até 10 minutos. Usa o original para vídeos maiores.');
    const { width, height } = fitMedia(video.displayWidth, video.displayHeight);
    const band = Math.max(80, Math.ceil(width * .14 / 2) * 2);
    const mp4 = await canEncodeVideo('avc', { width, height: height + band }) && (!audio || await audio.getCodec() === 'aac' || await canEncodeAudio('aac'));
    const codec = mp4 ? 'avc' : await canEncodeVideo('vp9', { width, height: height + band }) ? 'vp9' : 'vp8';
    logo = await loadBrandLogo(signal);
    signal.throwIfAborted();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height + band;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Não foi possível preparar o vídeo.');
    const chunks: { position: number; data: Uint8Array<ArrayBuffer> }[] = [];
    let size = 0, allocated = 0;
    const output = new Output({
      format: mp4 ? new Mp4OutputFormat({ fastStart: 'fragmented' }) : new WebMOutputFormat(),
      target: new StreamTarget(new WritableStream({ write(chunk) {
        signal.throwIfAborted();
        size = Math.max(size, chunk.position + chunk.data.byteLength);
        allocated += chunk.data.byteLength;
        if (size > EXPORT_LIMIT || allocated > EXPORT_LIMIT * 1.5) throw new Error('O vídeo exportado excede 100 MB. Usa o ficheiro original.');
        chunks.push({ position: chunk.position, data: chunk.data.slice() });
      } })),
    });
    conversion = await Conversion.init({ input, output, tracks: 'primary', showWarnings: false,
      video: { codec, width, height, fit: 'contain', frameRate: 30, quality: new Quality({ bitrate: 3_000_000 }), processedWidth: width, processedHeight: height + band,
        process(sample) {
          signal.throwIfAborted();
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height + band);
          sample.draw(ctx, 0, band, width, height);
          drawBrand(ctx, width, band, logo!, identity);
          return canvas;
        },
      },
      // Copy audio packets when compatible; otherwise transcode without dropping the track.
      audio: { codec: mp4 ? 'aac' : 'opus' },
    });
    if (!conversion.isValid || !conversion.utilizedTracks.includes(video) || (audio && !conversion.utilizedTracks.includes(audio))) {
      throw new Error('Este navegador não consegue exportar este vídeo com áudio. Usa o ficheiro original abaixo ou um navegador atualizado.');
    }
    signal.throwIfAborted();
    conversion.onProgress = progress => onProgress(Math.min(99, Math.round(progress * 100)));
    await conversion.execute();
    signal.throwIfAborted();
    const bytes = new Uint8Array(size);
    for (const chunk of chunks) bytes.set(chunk.data, chunk.position);
    chunks.length = 0;
    if (!size) throw new Error('O vídeo exportado está vazio.');
    const result = new File([bytes], `video-yamilook.${mp4 ? 'mp4' : 'webm'}`, { type: mp4 ? 'video/mp4' : 'video/webm' });
    // Validate the actual encoded file, including the presence of the original audio track.
    const check = new Input({ formats: ALL_FORMATS, source: new BlobSource(result) });
    try {
      if (!(await check.getPrimaryVideoTrack()) || (audio && !(await check.getPrimaryAudioTrack()))) throw new Error('A verificação do áudio ou do vídeo falhou. O ficheiro não será enviado.');
      if (Math.abs(await check.computeDuration() - duration) > Math.max(.5, duration * .01)) throw new Error('O vídeo ficou incompleto. Tenta novamente.');
    } finally { check.dispose(); }
    return result;
  } finally {
    signal.removeEventListener('abort', cancel);
    if (conversion?.state !== 'done') await conversion?.cancel().catch(() => undefined);
    input.dispose(); logo?.close();
  }
}
