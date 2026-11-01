import { useCallback, useEffect, useRef, useState } from 'react';
import { attachCallVideo, sameTracks } from '@/lib/call-media';
import { Volume2 } from 'lucide-react';

/** Video has its own attachment lifecycle; changing it must never pause audio. */
export function CallVideoOnly({ stream, contain = false }: { stream: MediaStream; contain?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const detach = attachCallVideo(stream, video);
    if (!detach) video.srcObject = new MediaStream(stream.getVideoTracks());
    void video.play().catch(() => {});
    return () => { detach?.(); video.pause(); video.srcObject = null; };
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`} />;
}

export function CallRemoteMedia({ stream, showVideo }: { stream: MediaStream; showVideo: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioTracks = useRef<MediaStreamTrack[]>([]);
  const audioGeneration = useRef(0);
  const [blocked, setBlocked] = useState(false);
  const playAudio = useCallback(async () => {
    const epoch = audioGeneration.current;
    try { await audioRef.current?.play(); if (epoch === audioGeneration.current) setBlocked(false); }
    catch { if (epoch === audioGeneration.current) setBlocked(true); }
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    const next = stream.getAudioTracks();
    if (!audio || sameTracks(audioTracks.current, next)) return;
    audioGeneration.current++;
    audioTracks.current = next;
    if (next.length) {
      audio.srcObject = new MediaStream(next);
      void playAudio();
    } else {
      audio.pause(); audio.srcObject = null; setBlocked(false);
    }
  }, [stream, playAudio]);
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      // Invalidate the latest pending play promise, not the epoch at mount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      audioGeneration.current++;
      audio?.pause();
      if (audio) audio.srcObject = null;
      audioTracks.current = [];
    };
  }, []);
  return <>
    <audio ref={audioRef} autoPlay />
    {showVideo && <CallVideoOnly stream={stream} />}
    {blocked && <button type="button" onClick={() => void playAudio()} className="absolute inset-x-3 top-12 z-30 rounded-full bg-primary px-3 py-2 text-primary-foreground">
      <Volume2 className="inline h-4 w-4 mr-2" />Activar som da chamada
    </button>}
  </>;
}
