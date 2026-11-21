import { load } from 'nsfwjs';

let model: ReturnType<typeof load> | undefined;
function readyModel() {
  model ??= load('MobileNetV2').catch(error => { model = undefined; throw error; });
  return model;
}

function waitFor(element: HTMLElement, event: string, start: () => void) {
  return new Promise<void>((resolve, reject) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      element.removeEventListener(event, success);
      element.removeEventListener('error', failure);
      if (ok) resolve(); else reject(new Error('Falha na leitura do ficheiro'));
    };
    const success = () => done(true);
    const failure = () => done(false);
    const timer = setTimeout(failure, 20000);
    element.addEventListener(event, success);
    element.addEventListener('error', failure);
    start();
  });
}

export async function scanMedia(raw: string): Promise<string> {
  try {
    const url = new URL(raw);
    if (url.origin !== new URL(import.meta.env.VITE_SUPABASE_URL).origin ||
        !url.pathname.startsWith('/storage/v1/object/public/media/')) return 'error';
    const detector = await readyModel();
    const flagged = async (frame: HTMLImageElement | HTMLVideoElement) =>
      (await detector.classify(frame)).some(p =>
        ['Porn', 'Hentai', 'Sexy'].includes(p.className) && p.probability >= 0.8);
    if (/\.(mp4|mov|webm|m4v|3gp|avi|mkv)$/i.test(url.pathname)) {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      try {
        await waitFor(video, 'loadeddata', () => { video.src = raw; video.load(); });
        if (!Number.isFinite(video.duration) || video.duration <= 0) return 'error';
        for (const fraction of [0, .1, .3, .5, .7, .9]) {
          if (fraction) await waitFor(video, 'seeked', () => { video.currentTime = video.duration * fraction; });
          if (await flagged(video)) return 'flagged';
        }
        return 'clear';
      } finally { video.removeAttribute('src'); video.load(); }
    }
    const image = new Image();
    image.crossOrigin = 'anonymous';
    await waitFor(image, 'load', () => { image.src = raw; });
    return await flagged(image) ? 'flagged' : 'clear';
  } catch { return 'error'; }
}
