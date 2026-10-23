export type ChatMediaKind = 'image' | 'video' | 'file';

const VIDEO_MIMES: Record<string, string> = {
  mov: 'video/quicktime', mp4: 'video/mp4', m4v: 'video/mp4',
  webm: 'video/webm', ogv: 'video/ogg', '3gp': 'video/3gpp',
};

export function chatMediaType(file: Pick<File, 'name' | 'type'>): ChatMediaKind {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (VIDEO_MIMES[extension]) return 'video';
  if (/^(jpe?g|png|gif|webp|avif|heic|heif)$/.test(extension)) return 'image';
  return 'file';
}

export function chatMediaContentType(file: Pick<File, 'name' | 'type'>): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  return VIDEO_MIMES[file.name.split('.').pop()?.toLowerCase() || ''] || file.type || 'application/octet-stream';
}

export function mediaCaption(content: string | null, url: string | null): string | null {
  if (!content) return null;
  try {
    const filename = decodeURIComponent(new URL(url || '').pathname.split('/').pop() || '');
    if (filename === content || filename.endsWith(`_${content}`)) return null;
  } catch { /* Keep genuine captions when the URL cannot be parsed. */ }
  return content;
}

// Request a frame after time zero for older uploads without a saved poster.
// Preserve query strings (including signatures) and existing media fragments.
export function videoThumbnailSource(url: string): string {
  return url && !url.includes('#') ? `${url}#t=0.1` : url;
}

export interface VideoPoster {
  blob: Blob;
  durationSeconds?: number;
}

/** Generate a small JPEG locally; an unsupported decoder must never block upload. */
export function createVideoPoster(file: File): Promise<VideoPoster | null> {
  return new Promise(resolve => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    let finished = false;
    const finish = (result: VideoPoster | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      video.onloadedmetadata = video.onloadeddata = video.onseeked = video.onerror = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
      resolve(result);
    };
    const timeout = setTimeout(() => finish(null), 6000);
    const capture = () => {
      if (finished || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
      try {
        const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { finish(null); return; }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const durationSeconds = Number.isFinite(video.duration) ? Math.ceil(video.duration) : undefined;
        canvas.toBlob(blob => finish(blob ? { blob, durationSeconds } : null), 'image/jpeg', 0.8);
      } catch { finish(null); }
    };
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      try { video.currentTime = Math.min(0.1, video.duration / 2 || 0); }
      catch { capture(); }
    };
    video.onloadeddata = video.onseeked = capture;
    video.onerror = () => finish(null);
    video.src = objectUrl;
    video.load();
  });
}
