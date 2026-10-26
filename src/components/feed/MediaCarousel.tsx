import { useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { optimizedPublicImageUrl } from '@/lib/image-delivery';

interface MediaCarouselProps {
  urls: string[];
  priority?: boolean;
  onDoubleTap?: () => void;
  likeOverlay?: ReactNode;
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)(?:[?#]|$)/i.test(url);
}

function VideoItem({ src, isActive }: { src: string; isActive: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [isVisible, setIsVisible] = useState(false);
  const [isNear, setIsNear] = useState(false);

  // Only play when both active in carousel AND visible in viewport
  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 }
    );
    observer.observe(v);
    // Mount a video source only as it approaches the viewport, not for every
    // post in the feed. Keep it mounted once near for scroll-back continuity.
    const nearObserver = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsNear(true); },
      { rootMargin: '300px 0px' }
    );
    nearObserver.observe(v);
    return () => { observer.disconnect(); nearObserver.disconnect(); };
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isActive && isVisible) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isActive, isVisible]);

  return (
    <div className="relative w-full h-full group" onClick={() => setMuted((m) => !m)}>
      <video
        ref={ref}
        src={isActive && isNear ? src : undefined}
        className="w-full h-full object-cover"
        preload={isActive && isVisible ? "metadata" : "none"}
        playsInline
        webkit-playsinline=""
        loop
        muted={muted}
      />
      {/* Mute indicator */}
      {muted && (
        <div className="absolute bottom-3 right-3 w-7 h-7 rounded-full bg-background/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <svg className="w-3.5 h-3.5 text-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .76-.12 1.5-.35 2.18" />
          </svg>
        </div>
      )}
    </div>
  );
}

function MediaImage({ src, priority }: { src: string; priority: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const optimized = optimizedPublicImageUrl(src, 960);
  return (
    <img
      src={failedSrc === src ? src : optimized}
      alt=""
      loading={priority ? 'eager' : 'lazy'}
      {...{ fetchpriority: priority ? 'high' : 'auto' }}
      decoding="async"
      onError={() => { if (optimized !== src && failedSrc !== src) setFailedSrc(src); }}
      className="w-full object-cover"
      style={{ maxHeight: '70vh', minHeight: '200px' }}
    />
  );
}

export function MediaCarousel({ urls, priority = false, onDoubleTap, likeOverlay }: MediaCarouselProps) {
  const validUrls = urls.filter((u) => u && u.trim() !== '');
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(idx);

  }, []);

  return (
    <div className="relative max-w-2xl mx-auto" onDoubleClick={onDoubleTap}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {validUrls.map((url, i) => (
          <div
            key={i}
            className="flex-shrink-0 w-full snap-center relative bg-black"
          >
            {isVideo(url) ? (
              <div style={{ maxHeight: '70vh', minHeight: '200px' }}>
                <VideoItem src={url} isActive={i === activeIndex} />
              </div>
            ) : (
              <MediaImage src={url} priority={priority && i === 0} />
            )}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {validUrls.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {validUrls.map((_, i) => (
            <span
              key={i}
              className={cn(
                'block rounded-full transition-all duration-200',
                i === activeIndex
                  ? 'w-2 h-2 bg-primary shadow-md'
                  : 'w-1.5 h-1.5 bg-foreground/40'
              )}
            />
          ))}
        </div>
      )}

      {/* Counter badge */}
      {validUrls.length > 1 && (
        <div className="absolute top-3 right-3 bg-background/60 backdrop-blur-sm rounded-lg px-2 py-0.5 z-10">
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {activeIndex + 1}/{validUrls.length}
          </span>
        </div>
      )}

      {/* Like overlay */}
      {likeOverlay}
    </div>
  );
}
