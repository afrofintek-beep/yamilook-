import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  MessageCircle, 
  Share2, 
  MoreVertical,
  Flag,
  Trash2,
  Archive,
  Sparkles
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Ritmo } from '@/hooks/useRitmos';
import { AfricanReactionType, AFRICAN_REACTIONS, getReactionIcon } from '@/lib/reactions';
import { useAuth } from '@/hooks/useAuth';
import { useLongPress } from '@/hooks/useLongPress';
import { formatDistanceToNow } from 'date-fns';

interface RitmoPlayerProps {
  ritmo: Ritmo;
  isActive: boolean;
  onReact: (type: AfricanReactionType) => void;
  onComment: () => void;
  onShare: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onView?: () => void;
}

export function RitmoPlayer({
  ritmo,
  isActive,
  onReact,
  onComment,
  onShare,
  onDelete,
  onArchive,
  onView,
}: RitmoPlayerProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionAnimation, setReactionAnimation] = useState<string | null>(null);
  const hasLoggedView = useRef(false);

  // Each activation owns its listeners and pending playback promise.
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    let cancelled = false;
    const attemptPlay = async () => {
      if (cancelled) return;
      try {
        await vid.play();
      } catch {
        if (cancelled) return;
        vid.muted = true;
        setIsMuted(true);
        try { await vid.play(); } catch { if (!cancelled) setIsPlaying(false); }
      }
      if (cancelled) return;
      setIsPlaying(!vid.paused);
    };
    if (isActive) {
      if (vid.readyState >= 3) void attemptPlay();
      else {
        vid.addEventListener('canplay', attemptPlay, { once: true });
        vid.load();
      }
    } else {
      vid.pause();
      vid.currentTime = 0;
      setIsPlaying(false);
    }
    return () => {
      cancelled = true;
      vid.removeEventListener('canplay', attemptPlay);
      vid.pause();
    };
  }, [isActive, ritmo.video_url]);

  // Count a view only once playback actually starts.
  const handlePlaying = () => {
    setIsPlaying(true);
    if (!hasLoggedView.current && onView) {
      hasLoggedView.current = true;
      onView();
    }
  };

  const handleVideoTap = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    if (!video.paused) video.pause();
    else void video.play().catch(() => setIsPlaying(false));
  }, [isActive]);

  // Quick react with Djembe (default)
  const handleQuickReact = useCallback(() => {
    onReact('djembe');
    setReactionAnimation('🪘');
    setTimeout(() => setReactionAnimation(null), 1000);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [onReact]);

  // Long press to show reaction picker
  const { handlers: longPressHandlers } = useLongPress({
    onLongPress: () => {
      setShowReactionPicker(true);
      if (navigator.vibrate) navigator.vibrate(50);
    },
    delay: 400,
  });

  // Handle reaction selection
  const handleSelectReaction = (type: AfricanReactionType) => {
    onReact(type);
    setShowReactionPicker(false);
    setReactionAnimation(getReactionIcon(type));
    setTimeout(() => setReactionAnimation(null), 1000);
  };

  // Calculate total reactions
  const totalReactions = ritmo.reaction_counts
    ? Object.values(ritmo.reaction_counts).reduce((a, b) => a + b, 0)
    : 0;

  const isOwner = user?.id === ritmo.user_id;

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center">
      {/* Video */}
      <video
        ref={videoRef}
        src={ritmo.video_url}
        className="w-full h-full object-cover"
        loop
        playsInline
        webkit-playsinline=""
        preload={isActive ? 'auto' : 'none'}
        muted={isMuted}
        onPlaying={handlePlaying}
        onPause={() => setIsPlaying(false)}
        onClick={handleVideoTap}
      />

      {/* Play/Pause overlay (shows briefly) */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reaction animation */}
      <AnimatePresence>
        {reactionAnimation && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 0 }}
            animate={{ opacity: 1, scale: 1.5, y: -50 }}
            exit={{ opacity: 0, scale: 2, y: -100 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none text-6xl"
          >
            {reactionAnimation}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top gradient */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

      {/* Top bar - Promoted badge only (location shown in feed header) */}
      <div className="absolute top-0 left-0 right-0 p-4 pt-safe flex items-center justify-end">
        {ritmo.is_promoted && (
          <div className="flex items-center gap-1 text-amber-300 text-xs bg-black/30 rounded-full px-2 py-1">
            <Sparkles className="w-3 h-3" />
            <span>Destaque Local</span>
          </div>
        )}
      </div>

      {/* Right side actions - with stopPropagation to prevent swipe interference */}
      <div 
        className="absolute right-3 bottom-32 flex flex-col items-center gap-5 z-20"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* User avatar with follow button */}
        <div className="relative">
          <button 
            className="relative" 
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile/${ritmo.user_id}`);
            }}
          >
            <Avatar className="w-12 h-12 border-2 border-white">
              <AvatarImage src={ritmo.user?.avatar_url || ''} />
              <AvatarFallback className="bg-primary text-primary-foreground">
                {ritmo.user?.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </button>
          {/* Follow badge */}
          {user?.id !== ritmo.user_id && (
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-md">
              +
            </div>
          )}
        </div>

        {/* Reaction button (tap for Djembe, long-press for picker) */}
        <div className="relative">
          <button
            className="flex flex-col items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              handleQuickReact();
            }}
            {...longPressHandlers}
          >
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-transform",
              ritmo.my_reaction && "scale-110"
            )}>
              {ritmo.my_reaction ? getReactionIcon(ritmo.my_reaction) : '🪘'}
            </div>
            <span className="text-white text-xs font-medium">{totalReactions || ''}</span>
          </button>

          {/* Reaction picker */}
          <AnimatePresence>
            {showReactionPicker && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowReactionPicker(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  className="absolute right-14 top-0 z-50 bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border p-2 flex gap-1"
                >
                  {AFRICAN_REACTIONS.map((reaction) => (
                    <button
                      key={reaction.type}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectReaction(reaction.type);
                      }}
                      className={cn(
                        "w-11 h-11 rounded-xl flex items-center justify-center text-2xl transition-all hover:bg-muted hover:scale-110",
                        ritmo.my_reaction === reaction.type && "bg-primary/20 ring-2 ring-primary"
                      )}
                      title={reaction.label}
                    >
                      {reaction.icon}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Comments */}
        <button 
          className="flex flex-col items-center gap-1" 
          onClick={(e) => {
            e.stopPropagation();
            onComment();
          }}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-medium">{ritmo.comments_count || ''}</span>
        </button>

        {/* Share */}
        <button 
          className="flex flex-col items-center gap-1" 
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
        >
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
        </button>

        {/* Mute toggle */}
        <button 
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>

        {/* More options */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-5 h-5 text-white" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {/* Archive - available for everyone */}
            {onArchive && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="w-4 h-4 mr-2" />
                Arquivar
              </DropdownMenuItem>
            )}
            {/* Report - available for everyone */}
            <DropdownMenuItem>
              <Flag className="w-4 h-4 mr-2" />
              Denunciar
            </DropdownMenuItem>
            {/* Delete - only for owner */}
            {isOwner && onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom info - User & Caption */}
      <div className="absolute bottom-4 left-4 right-20 pb-safe">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white font-semibold">
            @{ritmo.user?.username || ritmo.user?.display_name || 'user'}
          </span>
          <span className="text-white/60 text-sm">
            {formatDistanceToNow(new Date(ritmo.created_at), { addSuffix: true })}
          </span>
        </div>
        {ritmo.caption && (
          <p className="text-white text-sm leading-relaxed line-clamp-2">
            {ritmo.caption}
          </p>
        )}
      </div>
    </div>
  );
}
