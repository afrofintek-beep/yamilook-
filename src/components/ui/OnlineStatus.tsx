import { uiLocale, uiText, useUiLocale } from '@/i18n/ui-copy';
import { isRecentlyOnline } from '@/lib/online-presence';
import { usePresenceClock } from '@/hooks/usePresenceClock';
import { cn } from '@/lib/utils';

interface OnlineStatusProps {
  isOnline: boolean;
  lastSeen?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showBorder?: boolean;
  className?: string;
  // Privacy settings - if false, we don't show the status/lastSeen
  showOnlineStatus?: boolean;
  showLastSeen?: boolean;
}

export function OnlineStatus({ 
  isOnline, 
  lastSeen, 
  size = 'md',
  showBorder = true,
  className,
  showOnlineStatus = true,
  showLastSeen = true,
}: OnlineStatusProps) {
  useUiLocale();
  const now = usePresenceClock();
  const effectiveOnline = isRecentlyOnline(isOnline, lastSeen, now);
  // If user has disabled showing online status, don't render anything
  if (!showOnlineStatus) {
    return null;
  }

  const sizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const borderClasses = showBorder ? 'border-2 border-background' : '';

  // Determine title based on privacy settings
  const getTitle = () => {
    if (effectiveOnline) return uiText('Online');
    if (!showLastSeen) return uiText('Offline');
    return lastSeen ? uiText('Visto {{value1}}', { value1: formatLastSeen(lastSeen) }) : uiText('Offline');
  };

  return (
    <div
      className={cn(
        'rounded-full',
        sizeClasses[size],
        borderClasses,
        effectiveOnline ? 'bg-green-500' : 'bg-muted-foreground/50',
        className
      )}
      title={getTitle()}
    />
  );
}

export function formatLastSeen(lastSeen: string | null, respectPrivacy: boolean = true): string {
  if (!lastSeen) return uiText('Offline');
  
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const locale = uiLocale();
  if (!Number.isFinite(diffMs)) return '';
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (diffMins < 1) return relative.format(0, 'second');
  if (diffMins < 60) return relative.format(-diffMins, 'minute');
  if (diffHours < 24) return relative.format(-diffHours, 'hour');
  if (diffDays < 7) return relative.format(-diffDays, 'day');
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
