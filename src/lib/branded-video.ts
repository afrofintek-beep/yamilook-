import { uiText } from '@/i18n/ui-copy';
import { ALL_FORMATS, BlobSource, UrlSource, Conversion, Input, Output, Mp4OutputFormat, StreamTarget, canEncodeVideo, canEncodeAudio, Quality } from 'mediabunny';
import type { ExportIdentity } from './owned-post-media';
import { drawMediaBrand, fitMedia, loadBrandLogo } from './branded-media';

export const VIDEO_SHARE_LIMIT = 48 * 1024 * 1024;
let aacRegistration: Promise<void> | undefined;
async function ensureAacEncoder() {
  if (await canEncodeAudio('aac')) return;
  aacRegistration ??= import('@mediabunny/aac-encoder').then(({ registerAacEncoder }) => registerAacEncoder());
  await aacRegistration;
}

/** Bounded range reads let large originals be compressed without a whole-file download. */
export async function brandVideo(file: File | string, identity: ExportIdentity | null, signal: AbortSignal, onProgress: (progress: number) => void): Promise<File> {
  signal.throwIfAborted();
  const input = new Input({ formats: ALL_FORMATS, source: typeof file === 'string' ? new UrlSource(file, { maxCacheSize: 8 * 1024 * 1024, parallelism: 1, requestInit: { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' }, getRetryDelay: attempts => attempts < 2 ? 1 : null }) : new BlobSource(file) });
  let logo: ImageBitmap | undefined;
  let conversion: Conversion | undefined;
  const cancel = () => { void conversion?.cancel().catch(() => undefined); input.dispose(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video) throw new Error(uiText("O ficheiro não contém uma pista de vídeo."));
    const audio = await input.getPrimaryAudioTrack();
    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0 || duration > 600) throw new Error(uiText("A preparação automática suporta vídeos até 10 minutos. Divide o vídeo em partes mais curtas."));
    const { width, height } = fitMedia(video.displayWidth, video.displayHeight);
    if (!(await canEncodeVideo('avc', { width, height }))) throw new Error(uiText("Este navegador não permite preparar MP4. Abre a Yamilook no Safari ou Chrome atualizado e tenta novamente."));
    if (audio && await audio.getCodec() !== 'aac') await ensureAacEncoder();
    if (identity) logo = await loadBrandLogo(signal, true);
    // Reserve headroom for AAC and container metadata, even for long clips.
    const bitrate = Math.min(2_000_000, Math.floor(40 * 1024 * 1024 * 8 / duration) - 192_000);
    signal.throwIfAborted();
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(uiText("Não foi possível preparar o vídeo."));
    const chunks: { position: number; data: Uint8Array<ArrayBuffer> }[] = [];
    let size = 0, allocated = 0;
    const output = new Output({
      // Regular MP4 with a complete moov/sample table; fMP4 is not an app-share format.
      format: new Mp4OutputFormat({ fastStart: 'reserve' }),
      target: new StreamTarget(new WritableStream({ write(chunk) {
        signal.throwIfAborted();
        size = Math.max(size, chunk.position + chunk.data.byteLength);
        allocated += chunk.data.byteLength;
        if (size > VIDEO_SHARE_LIMIT || allocated > VIDEO_SHARE_LIMIT * 1.5) throw new Error(uiText("O vídeo exportado excede o limite de envio. Prepara um vídeo mais curto."));
        chunks.push({ position: chunk.position, data: chunk.data.slice() });
      } })),
    });
    conversion = await Conversion.init({ input, output, tracks: 'primary', showWarnings: false,
      video: { codec: 'avc', width, height, fit: 'contain', frameRate: 30, quality: new Quality({ bitrate }), processedWidth: width, processedHeight: height,
        process(sample) {
          signal.throwIfAborted();
          ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
          sample.draw(ctx, 0, 0, width, height);
          if (logo && identity) drawMediaBrand(ctx, width, height, logo, identity);
          return canvas;
        },
      },
      // Copy audio packets when compatible; otherwise transcode without dropping the track.
      audio: { codec: 'aac' },
    });
    if (!conversion.isValid || !conversion.utilizedTracks.includes(video) || (audio && !conversion.utilizedTracks.includes(audio))) {
      throw new Error(uiText("Este navegador não consegue exportar este vídeo com áudio. Abre a Yamilook no Safari ou Chrome atualizado e tenta novamente."));
    }
    signal.throwIfAborted();
    conversion.onProgress = progress => onProgress(Math.min(99, Math.round(progress * 100)));
    await conversion.execute();
    signal.throwIfAborted();
    const bytes = new Uint8Array(size);
    for (const chunk of chunks) bytes.set(chunk.data, chunk.position);
    chunks.length = 0;
    if (!size) throw new Error(uiText("O vídeo exportado está vazio."));
    const result = new File([bytes], 'video-yamilook.mp4', { type: 'video/mp4' });
    // Validate the actual encoded file, including the presence of the original audio track.
    const check = new Input({ formats: ALL_FORMATS, source: new BlobSource(result) });
    try {
      if (!(await check.getPrimaryVideoTrack()) || (audio && !(await check.getPrimaryAudioTrack()))) throw new Error(uiText("A verificação do áudio ou do vídeo falhou. O ficheiro não será enviado."));
      if (Math.abs(await check.computeDuration() - duration) > Math.max(.5, duration * .01)) throw new Error(uiText("O vídeo ficou incompleto. Tenta novamente."));
    } finally { check.dispose(); }
    return result;
  } finally {
    signal.removeEventListener('abort', cancel);
    if (conversion?.state !== 'done') await conversion?.cancel().catch(() => undefined);
    input.dispose(); logo?.close();
  }
}
