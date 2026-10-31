import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AFRICAN_REACTIONS, AfricanReactionType, getReaction } from '@/lib/reactions';

/**
 * YAMILOOK African Reaction System for Calls
 * 
 * FINAL ICONS (Cultural symbols - DO NOT REPLACE):
 * - 💛 Sankofa Love
 * - 🤝🏾 Ubuntu (skin tone intentional)
 * - 🪘 Djembe
 * - 💢 Shango
 * - 😒 Eish
 */

interface CallReactionsProps {
  inline?: boolean;
  onReaction: (type: AfricanReactionType) => void;
}

export function CallReactions({ onReaction, inline = false }: CallReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);

  const hoveredData = hoveredReaction ? getReaction(hoveredReaction) : null;

  return (
    <div className={inline ? "shrink-0" : "absolute bottom-32 left-4 z-20"}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className={cn("absolute bg-background/90 backdrop-blur-lg rounded-2xl p-3 shadow-xl border border-border", inline ? "bottom-full inset-x-2 mb-2 flex justify-center" : "bottom-16 left-0")}
            onMouseLeave={() => {
              setHoveredReaction(null);
              setIsOpen(false);
            }}
          >
            <div className="flex flex-col gap-2">
              {/* Reaction buttons */}
              <div className="flex gap-2">
                {AFRICAN_REACTIONS.map((reaction) => (
                  <button
                    key={reaction.type}
                    onClick={() => {
                      onReaction(reaction.type);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHoveredReaction(reaction.type)}
                    onMouseLeave={() => setHoveredReaction(null)}
                    className={cn(
                      "p-2 rounded-xl transition-all duration-200 text-2xl",
                      "hover:scale-110 hover:bg-white/20",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    )}
                    title={reaction.label}
                    aria-label={`${reaction.label}: ${reaction.meaning}`}
                  >
                    <span role="img" aria-hidden="true">{reaction.icon}</span>
                  </button>
                ))}
              </div>
              
              {/* Label on hover */}
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
                    <div className="text-center pt-1.5 border-t border-white/10 mt-1 space-y-0.5">
                      <p className="text-sm font-semibold text-white">
                        {hoveredData.label}
                      </p>
                      <p className="text-xs text-white/70 max-w-[180px]">
                        {hoveredData.meaning}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant="outline"
        size="icon"
        className="h-12 w-12 rounded-full border-white/20 bg-white/10 hover:bg-white/20"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open reactions"
        aria-expanded={isOpen}
      >
        <SmilePlus className="h-5 w-5 text-white" />
      </Button>
    </div>
  );
}
