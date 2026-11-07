import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, RefreshCw, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RitmoPlayer } from './RitmoPlayer';
import { RitmosCommentsSheet } from './RitmosCommentsSheet';
import { CreateRitmoSheet } from './CreateRitmoSheet';
import { useRitmos, Ritmo } from '@/hooks/useRitmos';
import { AfricanReactionType } from '@/lib/reactions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { getNearestCountry } from '@/lib/african-locations';
import { snapToGrid } from '@/lib/geo-privacy';

// Find nearest city from coordinates
function detectLocationFromCoords(lat: number, lng: number): { city: string } {
  const countryData = getNearestCountry(lat, lng);
  if (countryData && countryData.cities.length > 0) {
    return { city: countryData.cities[0].name };
  }
  return { city: 'Luanda' };
}

export function RitmosFeed() {
  useUiLocale();
  const navigate = useNavigate();
  const {
    ritmos,
    loading,
    currentCity,
    setCurrentCity,
    fetchRitmos,
    reactToRitmo,
    logView,
    deleteRitmo,
    archiveRitmo,
    seedPlaceholders,
  } = useRitmos();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRitmo, setSelectedRitmo] = useState<Ritmo | null>(null);
  const [hasDetectedLocation, setHasDetectedLocation] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // Auto-detect location on mount for filtering
  useEffect(() => {
    if (!hasDetectedLocation && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Snap to ~10m grid cell immediately — precise coords must never flow further
          const _cell = snapToGrid(position.coords.latitude, position.coords.longitude);
          const location = detectLocationFromCoords(_cell.lat, _cell.lng);
          setCurrentCity(location.city);
          fetchRitmos(location.city);
          setHasDetectedLocation(true);
        },
        () => {
          // Fall back to Luanda, Angola
          setCurrentCity('Luanda');
          fetchRitmos('Luanda');
          setHasDetectedLocation(true);
        },
        { timeout: 5000, enableHighAccuracy: false }
      );
    }
  }, [hasDetectedLocation, setCurrentCity, fetchRitmos]);

  // Handle swipe navigation
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartY.current - touchEndY.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentIndex < ritmos.length - 1) {
        // Swipe up - next
        setCurrentIndex(prev => prev + 1);
      } else if (diff < 0 && currentIndex > 0) {
        // Swipe down - previous
        setCurrentIndex(prev => prev - 1);
      }
    }
  }, [currentIndex, ritmos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && currentIndex < ritmos.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        setCurrentIndex(prev => prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, ritmos.length]);

  // Handle wheel navigation
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const threshold = 50;
    if (e.deltaY > threshold && currentIndex < ritmos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (e.deltaY < -threshold && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, ritmos.length]);

  // Handle reaction
  const handleReact = useCallback((ritmoId: string, type: AfricanReactionType) => {
    reactToRitmo(ritmoId, type);
  }, [reactToRitmo]);

  // Handle comment click
  const handleComment = useCallback((ritmo: Ritmo) => {
    setSelectedRitmo(ritmo);
    setCommentsOpen(true);
  }, []);

  // Handle share
  const handleShare = useCallback(async (ritmo: Ritmo) => {
    const url = `${window.location.origin}/ritmos/${ritmo.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: uiText("RITMOS"),
          text: ritmo.caption || 'Check out this Ritmo!',
          url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success(uiText("Link copied!"));
    }
  }, []);


  // Empty state
  if (!loading && ritmos.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black text-white p-8">
        <div className="text-6xl mb-6">🪘</div>
        <h2 className="text-2xl font-bold mb-2">{uiText("No Ritmos yet")}</h2>
        <p className="text-white/60 text-center mb-6">{uiText("Be the first to share a moment in your area!")}</p>
        <Button
          onClick={seedPlaceholders}
          className="bg-primary text-primary-foreground"
        >{uiText("Add Sample Ritmos")}</Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full bg-black relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Back button */}
      <div className="absolute top-4 left-4 z-30 safe-top">
        <Button
          variant="ghost"
          size="icon"
          className="bg-black/40 backdrop-blur-md text-white hover:bg-black/60 rounded-full"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>

      {/* Current Ritmo location display (no dropdown - shows each Ritmo's actual location) */}
      {ritmos[currentIndex] && (
        <div className="absolute top-4 left-24 right-24 z-30 safe-top flex justify-center">
          <div className="bg-black/40 backdrop-blur-md text-white rounded-full px-4 py-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-medium">
              {ritmos[currentIndex].neighborhood || ritmos[currentIndex].city || uiText("Sem local")}
            </span>
          </div>
        </div>
      )}

      {/* Top-right buttons */}
      <div className="absolute top-4 right-4 z-30 safe-top flex gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="bg-black/40 backdrop-blur-md text-white hover:bg-black/60 rounded-full"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="bg-black/40 backdrop-blur-md text-white hover:bg-black/60 rounded-full"
          onClick={() => fetchRitmos(currentCity || undefined)}
          disabled={loading}
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Video stack - render only current, previous and next for performance */}
      {/* Pause all videos when create sheet is open */}
      {ritmos.map((ritmo, index) => {
        // Only render items within range of current for better performance
        const isVisible = Math.abs(index - currentIndex) <= 1;
        if (!isVisible) return null;

        const isCurrent = index === currentIndex;
        const offset = index - currentIndex;

        // IMPORTANT: Pause video when create sheet is open to prevent background audio
        const shouldPlay = isCurrent && !createOpen && !commentsOpen;

        return (
          <motion.div
            key={ritmo.id}
            initial={false}
            animate={{
              opacity: isCurrent ? 1 : 0,
              y: `${offset * 100}%`,
              scale: isCurrent ? 1 : 0.9,
            }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-0"
            style={{
              zIndex: isCurrent ? 10 : 0,
              pointerEvents: isCurrent ? 'auto' : 'none',
            }}
          >
            <RitmoPlayer
              ritmo={ritmo}
              isActive={shouldPlay}
              onReact={(type) => handleReact(ritmo.id, type)}
              onComment={() => handleComment(ritmo)}
              onShare={() => handleShare(ritmo)}
              onDelete={() => deleteRitmo(ritmo.id)}
              onArchive={() => archiveRitmo(ritmo.id)}
              onView={() => logView(ritmo.id)}
            />
          </motion.div>
        );
      })}

      {/* Progress dots */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
        {ritmos.slice(0, 10).map((_, index) => (
          <div
            key={index}
            className={cn(
              "w-1 rounded-full transition-all",
              index === currentIndex
                ? "h-4 bg-white"
                : "h-1 bg-white/40"
            )}
          />
        ))}
        {ritmos.length > 10 && (
          <div className="text-white/60 text-xs">+{ritmos.length - 10}</div>
        )}
      </div>

      {/* Comments sheet */}
      <RitmosCommentsSheet
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        ritmo={selectedRitmo}
      />

      {/* Create Ritmo sheet */}
      <CreateRitmoSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </div>
  );
}
