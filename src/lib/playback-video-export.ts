import { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output } from 'mediabunny';
import { drawMediaBrand, fitMedia, loadBrandLogo } from './branded-media';
import type { ExportIdentity } from './owned-post-media';

const LIMIT = 48 * 1024 * 1024;
export function playbackExportSupported() {
  return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4')
    && typeof AudioContext !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

/** Called directly in a tap on the loaded source video; no camera or microphone capture. */
export async function exportVideoFromPlayback(video: HTMLVideoElement, identity: ExportIdentity, signal: AbortSignal, progress: (value: number) => void): Promise<File> {
  signal.throwIfAborted();
  if (!playbackExportSupported()) throw new Error('Este navegador não permite o modo compatível. Tenta no Safari atualizado.');
  if (video.readyState < 1 || !Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 600) throw new Error('Aguarda o carregamento do vídeo. O limite é de 10 minutos.');
  const duration = video.duration;
  const { width, height } = fitMedia(video.videoWidth, video.videoHeight, 960);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível preparar a imagem do vídeo.');
  const audio = new AudioContext();
  const source = audio.createMediaElementSource(video);
  const destination = audio.createMediaStreamDestination();
  source.connect(destination); // Original soundtrack only; do not connect to speakers.
  const stream = canvas.captureStream(30);
  destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
  let recorder: MediaRecorder | undefined;
  let logo: ImageBitmap | undefined;
  let frame = 0;
  let conversion: Conversion | undefined;
  let input: Input | undefined;
  const stop = () => {
    video.pause(); cancelAnimationFrame(frame);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach(track => track.stop());
    void conversion?.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    // Unlock both playback and Web Audio in the original user gesture on iPhone.
    const resumed = audio.resume();
    const playing = video.play();
    [logo] = await Promise.all([loadBrandLogo(signal, true), resumed, playing]);
    signal.throwIfAborted();
    if (audio.state !== 'running') throw new Error('Não foi possível ativar o áudio. Tenta novamente.');
    video.pause();
    if (video.currentTime > 0) await new Promise<void>((resolve, reject) => {
      const cleanup = () => { video.removeEventListener('seeked', done); signal.removeEventListener('abort', aborted); clearTimeout(timer); };
      const done = () => { cleanup(); resolve(); };
      const aborted = () => { cleanup(); reject(signal.reason); };
      const timer = window.setTimeout(() => { cleanup(); reject(new Error('Não foi possível regressar ao início do vídeo.')); }, 15000);
      video.addEventListener('seeked', done, { once: true }); signal.addEventListener('abort', aborted, { once: true });
      video.currentTime = 0;
    });
    const draw = () => {
      ctx.drawImage(video, 0, 0, width, height);
      drawMediaBrand(ctx, width, height, logo!, identity);
    };
    draw();
    const chunks: Blob[] = [];
    let size = 0;
    const mimeType = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type))!;
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.min(2_000_000, Math.floor(40 * 1024 * 1024 * 8 / duration) - 192_000), audioBitsPerSecond: 128000 });
    const recording = new Promise<Blob>((resolve, reject) => {
      let finished = false;
      let lastTime = 0, advancedAt = performance.now();
      const cleanup = () => { clearInterval(watchdog); video.removeEventListener('ended', ended); video.removeEventListener('error', failed); document.removeEventListener('visibilitychange', hidden); signal.removeEventListener('abort', aborted); };
      const fail = (error: unknown) => { if (finished) return; finished = true; cleanup(); stop(); reject(error); };
      const failed = () => fail(new Error('O navegador não conseguiu reproduzir este vídeo.'));
      const aborted = () => fail(signal.reason);
      const hidden = () => { if (document.hidden) fail(new Error('Preparação interrompida. Mantém esta página visível e tenta novamente.')); };
      const ended = () => { if (recorder?.state === 'recording') recorder.stop(); };
      const watchdog = window.setInterval(() => {
        if (video.currentTime > lastTime) { lastTime = video.currentTime; advancedAt = performance.now(); }
        if (performance.now() - advancedAt > 20000) fail(new Error('A reprodução ficou parada. Tenta novamente.'));
      }, 1000);
      recorder!.ondataavailable = event => { size += event.data.size; if (size > LIMIT) fail(new Error('A cópia excedeu o limite. Usa um vídeo mais curto.')); else if (event.data.size) chunks.push(event.data); };
      recorder!.onerror = failed;
      recorder!.onstop = () => {
        if (finished) return;
        finished = true; cleanup();
        if (video.currentTime < duration - .5 || !size) reject(new Error('A cópia ficou incompleta. Tenta novamente.'));
        else resolve(new Blob(chunks, { type: 'video/mp4' }));
      };
      video.addEventListener('ended', ended, { once: true }); video.addEventListener('error', failed, { once: true });
      document.addEventListener('visibilitychange', hidden); signal.addEventListener('abort', aborted, { once: true });
      const tick = () => { if (finished || signal.aborted) return; draw(); progress(Math.min(95, Math.round(video.currentTime / duration * 95))); frame = requestAnimationFrame(tick); };
      recorder!.start(1000); frame = requestAnimationFrame(tick);
      void video.play().catch(fail);
    });
    const blob = await recording;
    video.pause(); cancelAnimationFrame(frame); signal.throwIfAborted();
    // Remux native fragmented recordings into ordinary MP4 without using a decoder.
    input = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const target = new BufferTarget();
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
    const tracks = [await input.getPrimaryVideoTrack(), await input.getPrimaryAudioTrack()];
    if (tracks.some(track => !track)) throw new Error('A cópia não preservou o vídeo e o áudio.');
    if (await tracks[0]!.getCodec() !== 'avc' || await tracks[1]!.getCodec() !== 'aac') throw new Error('O navegador não gerou uma cópia MP4 compatível.');
    if (Math.abs(await input.computeDuration() - duration) > Math.max(1, duration * .02)) throw new Error('A cópia ficou incompleta. Tenta novamente.');
    conversion = await Conversion.init({ input, output, tracks: 'primary', showWarnings: false });
    if (!conversion.isValid || tracks.some(track => !conversion!.utilizedTracks.includes(track!))) throw new Error('Não foi possível finalizar a cópia com áudio.');
    await conversion.execute(); signal.throwIfAborted();
    if (!target.buffer?.byteLength || target.buffer.byteLength > LIMIT) throw new Error('A cópia excedeu o limite de envio.');
    progress(99);
    return new File([target.buffer], 'video-yamilook.mp4', { type: 'video/mp4' });
  } finally {
    signal.removeEventListener('abort', stop); stop(); input?.dispose(); logo?.close(); source.disconnect();
    await audio.close().catch(() => undefined);
    // A MediaElementAudioSourceNode cannot be attached to this element twice.
    video.removeAttribute('src'); video.load();
  }
}
