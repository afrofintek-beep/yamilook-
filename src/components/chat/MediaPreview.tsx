import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Download, Play, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { videoThumbnailSource } from '@/lib/chat-media';

function parseStoragePublicUrl(rawUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(rawUrl);
    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!projectUrl || url.origin !== new URL(projectUrl).origin) return null;
    const match = url.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    return match ? { bucket: match[1], path: decodeURIComponent(match[2]) } : null;
  } catch { return null; }
}

function getFilenameFromUrl(rawUrl: string) {
  try { return decodeURIComponent(new URL(rawUrl).pathname.split('/').pop() || 'media'); }
  catch { return 'media'; }
}

// Public media already has a CDN URL. Sign only after an actual loading failure
// (for legacy private objects), rather than replacing every working URL twice.
function useResolvedMediaUrl(url: string) {
  const [override, setOverride] = useState<{ source: string; url: string } | null>(null);
  const [error, setError] = useState(false);
  const [retryId, setRetryId] = useState(0);
  const attemptedRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const invalidatePending = useCallback(() => { generationRef.current++; }, []);

  useEffect(() => {
    invalidatePending();
    attemptedRef.current = null;
    setOverride(null);
    setError(false);
    return invalidatePending;
  }, [url, invalidatePending]);

  const onError = useCallback(async () => {
    const parsed = parseStoragePublicUrl(url);
    if (!parsed || attemptedRef.current === url) { setError(true); return; }
    attemptedRef.current = url;
    const generation = generationRef.current;
    try {
      const { data, error: signingError } = await supabase.storage.from(parsed.bucket).createSignedUrl(parsed.path, 3600);
      if (generation !== generationRef.current) return;
      if (signingError || !data?.signedUrl) { setError(true); return; }
      setOverride({ source: url, url: data.signedUrl });
      setError(false);
    } catch {
      if (generation === generationRef.current) setError(true);
    }
  }, [url]);

  const retry = () => {
    invalidatePending();
    attemptedRef.current = null;
    setError(false);
    setOverride(null);
    setRetryId(value => value + 1);
  };

  return { resolvedUrl: override?.source === url ? override.url : url, error, onError, retry, retryId };
}

interface MediaPreviewProps {
  url: string;
  type: 'image' | 'video';
  posterUrl?: string | null;
  open: boolean;
  onClose: () => void;
}

export function MediaPreview({ url, type, posterUrl, open, onClose }: MediaPreviewProps) {
  const { resolvedUrl, error, onError, retry, retryId } = useResolvedMediaUrl(url);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bindVideo = useCallback((video: HTMLVideoElement | null) => {
    if (videoRef.current && videoRef.current !== video) videoRef.current.pause();
    videoRef.current = video;
  }, []);

  useEffect(() => {
    if (!open) videoRef.current?.pause();
  }, [open]);

  const handleClose = () => {
    videoRef.current?.pause();
    onClose();
  };

  // A normal link avoids fetching the whole video into memory to download it.
  const downloadUrl = (() => {
    try {
      const target = new URL(resolvedUrl);
      if (parseStoragePublicUrl(url)) target.searchParams.set('download', getFilenameFromUrl(url));
      return target.toString();
    } catch { return resolvedUrl; }
  })();

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) handleClose(); }}>
      <DialogContent hideCloseButton aria-describedby={undefined}
        className="flex flex-col min-w-0 w-[calc(100%-1rem)] max-w-3xl h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] max-h-[calc(100dvh-2rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] p-0 gap-0 overflow-hidden bg-black border-none text-white">
        <DialogTitle className="sr-only">{type === 'video' ? 'Reproduzir vídeo' : 'Ver fotografia'}</DialogTitle>
        <div className="relative z-10 flex min-w-0 items-center justify-between gap-3 px-3 py-2 shrink-0 bg-black">
          <span className="text-sm">{type === 'video' ? 'Vídeo' : 'Fotografia'}</span>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-white/20">
              <a href={downloadUrl} download={getFilenameFromUrl(url)} target="_blank" rel="noopener noreferrer" aria-label="Descarregar ficheiro">
                <Download className="w-5 h-5" />
              </a>
            </Button>
            <Button variant="ghost" aria-label="Fechar pré-visualização"
              className="h-11 shrink-0 gap-1 rounded-full px-3 text-white hover:bg-white/20" onClick={handleClose}>
              <X className="w-5 h-5" />
              <span>Fechar</span>
            </Button>
          </div>
        </div>
        <div className="relative min-h-0 min-w-0 flex-1 flex items-center justify-center overflow-hidden bg-black">
          {type === 'image' ? (
            <img key={`${resolvedUrl}-${retryId}`} src={resolvedUrl} alt="Fotografia"
              className="block min-w-0 w-full h-full max-w-full max-h-full object-contain" onError={() => void onError()} />
          ) : (
            <video key={`${resolvedUrl}-${retryId}`} ref={bindVideo} src={resolvedUrl} poster={posterUrl || undefined}
              aria-label="Vídeo da conversa" controls autoPlay playsInline preload="metadata"
              className="block min-w-0 w-full h-full max-w-full max-h-full object-contain" onError={() => void onError()} />
          )}
        </div>
        {error && (
          <div role="alert" className="shrink-0 max-h-32 overflow-y-auto px-4 py-3 text-center text-sm bg-zinc-900">
            <p>Não foi possível reproduzir este ficheiro. Tenta novamente ou descarrega-o para abrir no telefone.</p>
            <Button variant="ghost" className="mt-2 hover:bg-white/20" onClick={retry}>
              <RotateCcw className="w-4 h-4 mr-2" />Tentar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MediaThumbnailProps {
  url: string;
  type: 'image' | 'video';
  posterUrl?: string | null;
  durationSeconds?: number;
  onClick?: () => void;
}

export function MediaThumbnail({ url, type, posterUrl, durationSeconds, onClick }: MediaThumbnailProps) {
  const { resolvedUrl, error, onError } = useResolvedMediaUrl(url);
  const [aspectRatio, setAspectRatio] = useState(3 / 4);
  const [metadataDuration, setMetadataDuration] = useState<number | undefined>();
  const isVideo = type === 'video';
  const seconds = durationSeconds || metadataDuration;
  const duration = seconds && Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}` : null;

  useEffect(() => { setMetadataDuration(undefined); setAspectRatio(3 / 4); }, [url]);

  return (
    <button type="button" onClick={onClick} aria-label={isVideo ? 'Reproduzir vídeo' : 'Ver fotografia'}
      className={`relative block max-w-full rounded-xl overflow-hidden bg-black text-white ${isVideo ? 'w-[240px]' : 'w-[280px]'}`}
      style={isVideo ? { aspectRatio } : undefined}>
      {isVideo ? (
        <>
          <video key={resolvedUrl} src={posterUrl ? undefined : videoThumbnailSource(resolvedUrl)}
            poster={posterUrl || undefined} muted playsInline preload="metadata" aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            onLoadedMetadata={event => {
              const video = event.currentTarget;
              if (video.videoWidth && video.videoHeight) setAspectRatio(Math.max(3 / 4, Math.min(16 / 9, video.videoWidth / video.videoHeight)));
              if (Number.isFinite(video.duration)) setMetadataDuration(Math.ceil(video.duration));
            }} onError={() => void onError()} />
          <span className="absolute inset-0 flex flex-col gap-2 items-center justify-center bg-black/20 pointer-events-none">
            <span className="w-14 h-14 rounded-full bg-black/70 flex items-center justify-center ring-1 ring-white/50">
              <Play className="w-7 h-7 fill-white ml-1" />
            </span>
            {error && <span className="text-xs px-3 text-center">Toca para abrir o vídeo</span>}
          </span>
          <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-1 text-xs">Vídeo</span>
          {duration && <span className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs">{duration}</span>}
        </>
      ) : (
        <img src={resolvedUrl} alt="Fotografia da conversa" loading="lazy" decoding="async"
          className="w-full h-auto object-cover" onError={() => void onError()} />
      )}
    </button>
  );
}
