import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { motion } from 'framer-motion';

interface LiveIndicatorBadgeProps {
  className?: string;
}

export function LiveIndicatorBadge({ className = '' }: LiveIndicatorBadgeProps) {
  useUiLocale();
  return (
    <motion.span
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`absolute -top-1 -right-1 flex items-center justify-center ${className}`}
    >
      <span className="relative flex h-4 w-4">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
        <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive items-center justify-center">
          <span className="text-[8px] font-bold text-destructive-foreground">{uiText("LIVE")}</span>
        </span>
      </span>
    </motion.span>
  );
}
