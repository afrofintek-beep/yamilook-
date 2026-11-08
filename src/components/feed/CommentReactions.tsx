import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AFRICAN_REACTIONS,
  AfricanReactionType,
  getReaction,
  ReactionCounts,
  getTotalReactions,
  getTopReactions,
} from '@/lib/reactions';

/**
 * YAMILOOK African Reaction System for Comments
 *
 * FINAL ICONS (Cultural symbols - DO NOT REPLACE):
 * - 💛 Sankofa Love
 * - 🤝🏾 Ubuntu (skin tone intentional)
 * - 🪘 Djembe
 * - 💢 Shango
 * - 😒 Eish
 *
 * Displays:
 * - Total reactions count
 * - Subtotals per reaction type (on hover/expand)
 * - Reaction picker on click
 */

// Re-export for backward compatibility
export { AFRICAN_REACTIONS };

interface CommentReactionsProps {
  commentId: string;
  reactions: Partial<ReactionCounts>;
  myReaction: string | null;
  onReact: (commentId: string, reactionType: AfricanReactionType) => void;
  compact?: boolean;
  showSubtotals?: boolean;
}

export function CommentReactions({
  commentId,
  reactions,
  myReaction,
  onReact,
  compact = false,
  showSubtotals = false,
}: CommentReactionsProps) {
  useUiLocale();
  const [showPicker, setShowPicker] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);

  // Get total and top reactions
  const total = getTotalReactions(reactions);
  const topReactions = getTopReactions(reactions, 3);
  const myReactionData = myReaction ? getReaction(myReaction) : null;

  const handleReact = (type: AfricanReactionType) => {
    onReact(commentId, type);
    setShowPicker(false);
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      {/* Display existing reactions with total */}
      {topReactions.length > 0 && (
        <div className="flex items-center gap-1">
          {/* Top reaction icons */}
          <div className="flex -space-x-0.5">
            {topReactions.map(({ type, reaction }) => (
              <span
                key={type}
                className="text-sm"
                title={`${reaction.label}: ${reactions[type as keyof ReactionCounts] || 0}`}
                role="img"
                aria-label={reaction.label}
              >
                {reaction.icon}
              </span>
            ))}
          </div>

          {/* Total count */}
          <span className="text-xs text-muted-foreground">
            {total}
          </span>

          {/* Subtotals breakdown (optional) */}
          {showSubtotals && (
            <div className="flex items-center gap-1.5 ml-1 text-xs text-muted-foreground">
              {AFRICAN_REACTIONS.map((reaction) => {
                const count = reactions[reaction.type as keyof ReactionCounts] || 0;
                if (count === 0) return null;
                return (
                  <span key={reaction.type} className="flex items-center gap-0.5" title={reaction.label}>
                    <span role="img" aria-hidden="true">{reaction.icon}</span>
                    <span>{count}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* React button */}
      <button
        className={cn(
          "text-xs transition-all duration-200 flex items-center gap-1 rounded-md px-1.5 py-0.5",
          myReaction
            ? "font-medium bg-secondary/50"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
        )}
        onClick={() => setShowPicker(!showPicker)}
        onMouseEnter={() => setShowPicker(true)}
        aria-label={myReaction ? uiText("Your reaction: {{value1}}", { value1: (myReactionData?.label) ?? "" }) : uiText("Add reaction")}
        aria-haspopup="true"
        aria-expanded={showPicker}
      >
        {myReaction && myReactionData ? (
          <>
            <span role="img" aria-hidden="true">{myReactionData.icon}</span>
            {!compact && <span className="hidden sm:inline">{myReactionData.label}</span>}
          </>
        ) : (
          <span>{compact ? '💛' : uiText("React")}</span>
        )}
      </button>

      {/* Reaction picker */}
      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowPicker(false);
                setHoveredReaction(null);
              }
            }}
            role="menu"
            aria-label={uiText("Choose a reaction")}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-card border border-border rounded-2xl shadow-xl p-4 mx-4 max-w-[320px] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Reaction buttons */}
              <div className="flex justify-center gap-2 mb-3">
                {AFRICAN_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    onClick={() => handleReact(reaction.type)}
                    onMouseEnter={() => setHoveredReaction(reaction.type)}
                    onTouchStart={() => setHoveredReaction(reaction.type)}
                    onMouseLeave={() => setHoveredReaction(null)}
                    className={cn(
                      "p-3 rounded-xl transition-all duration-200 text-2xl",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "hover:scale-110 hover:bg-secondary/50 active:scale-95",
                      myReaction === reaction.type && "bg-secondary scale-105 ring-2 ring-primary/30"
                    )}
                    role="menuitem"
                    aria-label={`${reaction.label}: ${reaction.meaning}`}
                    aria-pressed={myReaction === reaction.type}
                  >
                    <span role="img" aria-hidden="true">{reaction.icon}</span>
                  </button>
                ))}
              </div>

              {/* Label shown on hover/touch - always visible area */}
              <div className="min-h-[60px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                  {hoveredReaction ? (
                    <motion.div
                      key={hoveredReaction}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.1 }}
                      className="text-center space-y-1"
                    >
                      <p className="font-semibold text-base text-foreground">
                        {getReaction(hoveredReaction)?.label}
                      </p>
                      <p className="text-sm text-muted-foreground leading-snug">
                        {getReaction(hoveredReaction)?.meaning}
                      </p>
                    </motion.div>
                  ) : (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-sm text-muted-foreground text-center"
                    >{uiText("Toque numa reação para ver o significado")}</motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Close hint */}
              <p className="text-xs text-muted-foreground/60 text-center mt-2">{uiText("Toque fora para fechar")}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
