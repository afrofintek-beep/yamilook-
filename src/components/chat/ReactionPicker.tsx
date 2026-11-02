import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { AFRICAN_REACTIONS, AfricanReactionType, getReaction } from '@/lib/reactions';
import { cn } from '@/lib/utils';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';
  myReaction?: string | null;
}

export function ReactionPicker({ onSelect, onClose, position = 'top', myReaction = null }: ReactionPickerProps) {
  const { t } = useTranslation();
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const hoveredData = hoveredReaction ? getReaction(hoveredReaction) : null;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Only close if clicking outside
      const target = e.target as HTMLElement;
      if (!target.closest('[data-reaction-picker]')) {
        onClose();
      }
    };
    
    // Delay adding listener to prevent immediate close
    const timeout = setTimeout(() => {
      document.addEventListener('click', handleClick);
    }, 100);
    
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleClick);
    };
  }, [onClose]);

  const handleReact = (type: AfricanReactionType) => {
    onSelect(type);
    onClose();
  };

  return (
    <motion.div
      data-reaction-picker
      initial={{ opacity: 0, scale: 0.8, y: position === 'top' ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-0 z-50`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-lg p-2 flex flex-col gap-1">
        {/* African Reactions */}
        <div className="flex items-center gap-1">
          {AFRICAN_REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              onClick={() => handleReact(reaction.type)}
              onMouseEnter={() => setHoveredReaction(reaction.type)}
              onMouseLeave={() => setHoveredReaction(null)}
              className={cn(
                "w-10 h-10 flex items-center justify-center text-xl rounded-xl transition-all duration-200",
                "hover:scale-125 hover:bg-secondary/50",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                myReaction === reaction.type && "bg-secondary scale-110"
              )}
              aria-label={`${reaction.label}: ${t(`kosolola.reactionMeanings.${reaction.type}`, { fallbackLng: 'pt' })}`}
            >
              <span role="img" aria-hidden="true">{reaction.icon}</span>
            </button>
          ))}
        </div>
        
        {/* Label shown on hover */}
        <AnimatePresence mode="wait">
          {hoveredData && (
            <motion.div
              key={hoveredData.type}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.1 }}
              className="overflow-hidden"
            >
              <div className="text-center pt-1.5 border-t border-border mt-1 space-y-0.5">
                <p className="font-semibold text-sm text-foreground">
                  {hoveredData.label}
                </p>
                <p className="text-xs text-muted-foreground max-w-[180px]">
                  {t(`kosolola.reactionMeanings.${hoveredData.type}`, { fallbackLng: 'pt' })}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

interface ReactionDisplayProps {
  reactions: { emoji: string; count: number; users: string[] }[];
  currentUserId: string;
  onToggle: (emoji: string) => void;
}

// Animation variants for each reaction type
const reactionAnimations: Record<string, { 
  animate: { scale?: number[]; rotate?: number[]; y?: number[]; x?: number[] }; 
  transition: { duration: number; repeat: number; repeatDelay: number } 
}> = {
  sankofa: {
    animate: { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] },
    transition: { duration: 0.6, repeat: Infinity, repeatDelay: 2 }
  },
  ubuntu: {
    animate: { scale: [1, 1.15, 1], y: [0, -2, 0] },
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }
  },
  djembe: {
    animate: { rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.1, 1] },
    transition: { duration: 0.4, repeat: Infinity, repeatDelay: 1.5 }
  },
  shango: {
    animate: { scale: [1, 1.2, 0.95, 1.15, 1], x: [0, -2, 2, -1, 0] },
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
  },
  eish: {
    animate: { rotate: [0, 5, -5, 0], y: [0, 1, 0] },
    transition: { duration: 0.8, repeat: Infinity, repeatDelay: 3 }
  }
};

export function ReactionDisplay({ reactions, currentUserId, onToggle }: ReactionDisplayProps) {
  if (reactions.length === 0) return null;

  // Get African reaction data for display
  const getDisplayData = (emoji: string) => {
    const reaction = getReaction(emoji);
    if (reaction) {
      return { icon: reaction.icon, label: reaction.label, type: reaction.type };
    }
    // Fallback for legacy emoji reactions
    return { icon: emoji, label: emoji, type: null };
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <AnimatePresence mode="popLayout">
        {reactions.map(({ emoji, count, users }, index) => {
          const hasReacted = users.includes(currentUserId);
          const displayData = getDisplayData(emoji);
          const animation = displayData.type ? reactionAnimations[displayData.type] : null;
          
          return (
            <motion.button
              key={emoji}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              transition={{ 
                type: "spring", 
                stiffness: 400, 
                damping: 15,
                delay: index * 0.05
              }}
              onClick={() => onToggle(emoji)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200",
                "shadow-sm backdrop-blur-sm",
                hasReacted
                  ? 'bg-primary/25 border-2 border-primary/40 shadow-primary/20'
                  : 'bg-secondary/60 border border-border/50 hover:bg-secondary hover:border-border'
              )}
              title={displayData.label}
            >
              <motion.span 
                className="text-xl leading-none"
                animate={animation?.animate}
                transition={animation?.transition}
              >
                {displayData.icon}
              </motion.span>
              <motion.span 
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  hasReacted ? "text-primary" : "text-muted-foreground"
                )}
                key={count}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                {count}
              </motion.span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
