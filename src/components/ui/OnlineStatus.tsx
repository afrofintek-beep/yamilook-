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
    if (effectiveOnline) return 'Online';
    if (!showLastSeen) return 'Offline';
    return lastSeen ? `Visto ${formatLastSeen(lastSeen)}` : 'Offline';
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
  if (!lastSeen) return 'Offline';
  
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'agora mesmo';
  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 7) return `há ${diffDays} dias`;
  
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}
