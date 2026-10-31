import { useCallback, useEffect, useRef, useState } from 'react';
import { attachCallVideo } from '@/lib/call-media';
import { Volume2 } from 'lucide-react';

/** A single audio sink per tile. Muted video can autoplay on iOS independently;
 * blocked audio always has an explicit user-gesture recovery control. */
export function CallRemoteMedia({ stream, showVideo }: { stream: MediaStream; showVideo: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);
  const playAudio = useCallback(async () => {
    try { await audioRef.current?.play(); setBlocked(false); }
    catch { setBlocked(true); }
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (audio) audio.srcObject = new MediaStream(stream.getAudioTracks());
    let detachVideo: (() => void) | null = null;
    if (video) {
      detachVideo = attachCallVideo(stream, video);
      if (!detachVideo) video.srcObject = new MediaStream(stream.getVideoTracks());
      void video.play().catch(() => {});
    }
    if (stream.getAudioTracks().length) void playAudio();
    return () => {
      detachVideo?.();
      if (audio) { audio.pause(); audio.srcObject = null; }
      if (video) { video.pause(); video.srcObject = null; }
    };
  }, [stream, showVideo, playAudio]);
  return <>
    <audio ref={audioRef} autoPlay />
    {showVideo && <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />}
    {blocked && <button type="button" onClick={() => void playAudio()} className="absolute inset-x-3 top-12 z-30 rounded-full bg-primary px-3 py-2 text-primary-foreground">
      <Volume2 className="inline h-4 w-4 mr-2" />Activar som da chamada
    </button>}
  </>;
}
