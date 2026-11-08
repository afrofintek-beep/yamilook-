import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  AFRICAN_REACTIONS,
  ReactionCounts,
  getTotalReactions,
  getTopReactions,
  getReactionIcon
} from '@/lib/reactions';

/**
 * YAMILOOK Reaction Display
 *
 * Displays reaction totals and subtotals:
 * - Shows top 3 reaction icons + total count by default
 * - On click/press: expands to show breakdown per reaction type
 */

interface ReactionDisplayProps {
  counts: Partial<ReactionCounts>;
  myReaction?: string | null;
  showTotal?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ReactionDisplay({
  counts,
  myReaction,
  showTotal = true,
  size = 'md',
  className,
}: ReactionDisplayProps) {
  useUiLocale();
  const { t } = useTranslation();
  const [showSubtotals, setShowSubtotals] = useState(false);
  const total = getTotalReactions(counts);
  const topReactions = getTopReactions(counts, 3);

  if (total === 0 && !myReaction) {
    return null;
  }

  const sizeClasses = {
    sm: 'text-sm gap-0.5',
    md: 'text-base gap-1',
    lg: 'text-lg gap-1.5',
  };

  const iconSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
  };

  const handleToggleSubtotals = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setShowSubtotals(!showSubtotals);
  };

  return (
    <div
      className={cn(
        "flex items-center cursor-pointer select-none",
        sizeClasses[size],
        className
      )}
      onClick={handleToggleSubtotals}
      role="button"
      aria-expanded={showSubtotals}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSubtotals(v => !v); } }}
      aria-label={t('feed.reactionCount', { count: total })}
    >
      {!showSubtotals ? (
        // Collapsed view: only total number
        <>
          {showTotal && total > 0 && (
            <span className="text-muted-foreground">
              {t('feed.reactionCount', { count: total })}
            </span>
          )}
        </>
      ) : (
        // Expanded view: each reaction type with its count
        <div className="flex items-center gap-2 flex-wrap">
          {AFRICAN_REACTIONS.map((reaction) => {
            const count = counts[reaction.type as keyof ReactionCounts] || 0;
            if (count === 0) return null;
            return (
              <span
                key={reaction.type}
                className="flex items-center gap-0.5 bg-muted/50 rounded-full px-2 py-0.5"
              >
                <span className={iconSizes[size]} role="img" aria-label={reaction.label}>
                  {reaction.icon}
                </span>
                <span className="text-sm font-medium">{count}</span>
              </span>
            );
          })}
          <span className="text-muted-foreground text-xs ml-1">{uiText("({{value1}} total)", { value1: (total) ?? "" })}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Compact reaction summary for lists/feeds
 */
interface ReactionSummaryProps {
  counts: Partial<ReactionCounts>;
  className?: string;
}

export function ReactionSummary({ counts, className }: ReactionSummaryProps) {
  useUiLocale();
  const total = getTotalReactions(counts);
  const topReactions = getTopReactions(counts, 3);

  if (total === 0) return null;

  return (
    <div className={cn("flex items-center gap-1 text-sm text-muted-foreground", className)}>
      <div className="flex -space-x-0.5">
        {topReactions.map(({ type, reaction }) => (
          <span key={type} className="text-base" role="img" aria-label={reaction.label}>
            {reaction.icon}
          </span>
        ))}
      </div>
      <span>{total}</span>
    </div>
  );
}
