import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AFRICAN_REACTIONS, AfricanReactionType, getReaction } from '@/lib/reactions';

/**
 * YAMILOOK African Reaction Picker
 *
 * Displays the 5 official African reactions with:
 * - Final emoji icons (cultural symbols - DO NOT REPLACE)
 * - Hover/long-press shows name and meaning
 * - Click selects the reaction
 * - +10% brightness on hover only (no gradients, no looping animations)
 */

interface AfricanReactionPickerProps {
  myReaction: string | null;
  onReact: (reactionType: AfricanReactionType) => void;
  onClose?: () => void;
  position?: 'top' | 'bottom';
}

export function AfricanReactionPicker({
  myReaction,
  onReact,
  onClose,
  position = 'top',
}: AfricanReactionPickerProps) {
  useUiLocale();
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const hoveredData = hoveredReaction ? getReaction(hoveredReaction) : null;

  const handleReact = (type: AfricanReactionType) => {
    onReact(type);
    onClose?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: position === 'top' ? 4 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: position === 'top' ? 4 : -4 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "absolute z-50",
        position === 'top' ? "bottom-full mb-2" : "top-full mt-2",
        "left-0"
      )}
      onMouseLeave={() => {
        setHoveredReaction(null);
        onClose?.();
      }}
      role="menu"
      aria-label={uiText("Choose a reaction")}
    >
      <div className="bg-card border border-border rounded-2xl shadow-brand-md p-2 flex flex-col gap-1">
        {/* Reaction buttons */}
        <div className="flex gap-1">
          {AFRICAN_REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              onClick={() => handleReact(reaction.type)}
              onMouseEnter={() => setHoveredReaction(reaction.type)}
              onMouseLeave={() => setHoveredReaction(null)}
              className={cn(
                "p-2 rounded-xl transition-all duration-200 text-2xl",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:scale-110 hover:bg-secondary/50",
                myReaction === reaction.type && "bg-secondary scale-105"
              )}
              role="menuitem"
              aria-label={`${reaction.label}: ${reaction.meaning}`}
              aria-pressed={myReaction === reaction.type}
            >
              <span role="img" aria-hidden="true">{reaction.icon}</span>
            </button>
          ))}
        </div>

        {/* Label shown on hover - accessibility requirement */}
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
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  {hoveredData.meaning}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
