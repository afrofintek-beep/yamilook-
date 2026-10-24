import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Pause, Play } from 'lucide-react';
import { useResolvedMediaUrl } from './MediaPreview';

interface VoiceMessagePlayerProps {
  /**
   * Can be:
   * - a blob: URL (optimistic local playback while uploading)
   * - an http(s) public URL (final state)
   * - empty string (still uploading)
   */
  url: string | null;
  duration?: number;
  isOwn?: boolean;
}

export function VoiceMessagePlayer({ url, duration, isOwn }: VoiceMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const { resolvedUrl, error: resolutionError, onError: resolveError } = useResolvedMediaUrl(url || '');

  // Uploading = no url or empty placeholder (waiting for upload to finish)
  const isUploading = !url || url === '';
  // Playable = blob: (local) or http(s) (final)
  const isPlayable = !!resolvedUrl && (resolvedUrl.startsWith('http') || resolvedUrl.startsWith('blob:'));

  const bars = useMemo(() => {
    // Generate waveform bars (stable across renders)
    return Array.from({ length: 30 }, (_, i) => 20 + Math.sin(i * 0.5) * 15 + Math.random() * 10);
  }, []);

  // Reset state when url changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setError(false);
    setIsLoading(true);
    setWaitSeconds(0);
  }, [url]);

  useEffect(() => { setError(false); setIsLoading(true); }, [resolvedUrl]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isPlayable || !resolvedUrl) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      setTotalDuration(audio.duration || duration || 0);
      setIsLoading(false);
      setError(false);
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      void resolveError();
      console.error('Audio error:', audio.error);
      setError(true);
      setIsLoading(false);
      setIsPlaying(false);
    };
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    // Start loading
    setIsLoading(true);
    audio.load();

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [resolvedUrl, isPlayable, duration]);

  // Timer for wait indicator
  useEffect(() => {
    if (!isUploading && !isLoading) return;

    const t = window.setInterval(() => setWaitSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [isUploading, isLoading]);

  const togglePlay = async () => {
    if (!audioRef.current || error || !isPlayable) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        if (audioRef.current.currentTime >= totalDuration && totalDuration > 0) {
          audioRef.current.currentTime = 0;
        }
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Playback error:', err);
      setError(true);
      setIsPlaying(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  // Uploading state
  if (isUploading) {
    return (
      <div className="flex items-center gap-3 min-w-[200px]">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isOwn ? 'bg-white/20' : 'bg-primary/20'
          }`}
        >
          <Loader2 className={`w-5 h-5 animate-spin ${isOwn ? 'text-white' : 'text-primary'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-end gap-0.5 h-8 mb-1 opacity-50">
            {bars.map((height, i) => (
              <div
                key={i}
                className={`w-1 rounded-full ${isOwn ? 'bg-white/40' : 'bg-muted-foreground/30'}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs opacity-70">
            <span className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              A enviar... {waitSeconds > 0 ? `(${waitSeconds}s)` : ''}
            </span>
            <span>{formatTime(duration || 0)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || resolutionError) {
    return (
      <div className="flex items-center gap-3 min-w-[200px] opacity-60">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isOwn ? 'bg-white/20' : 'bg-muted'
          }`}
        >
          <AlertCircle className={`w-5 h-5 ${isOwn ? 'text-white' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1">
          <p className={`text-xs ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>Áudio não disponível</p>
        </div>
      </div>
    );
  }

  // Ready / Playing state
  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio ref={audioRef} src={resolvedUrl || undefined} preload="metadata" />

      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity ${
          isOwn ? 'bg-white/20' : 'bg-primary'
        } ${isLoading ? 'opacity-50' : ''}`}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5 text-white" />
        ) : (
          <Play className="w-5 h-5 ml-0.5 text-white" />
        )}
      </button>

      <div className="flex-1">
        <div className="flex items-end gap-0.5 h-8 mb-1">
          {bars.map((height, i) => {
            const isActive = (i / bars.length) * 100 <= progress;
            return (
              <div
                key={i}
                className={`w-1 rounded-full transition-colors ${
                  isActive ? (isOwn ? 'bg-white' : 'bg-primary') : isOwn ? 'bg-white/40' : 'bg-muted-foreground/30'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs opacity-70">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
}
