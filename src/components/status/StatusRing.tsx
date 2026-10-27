import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface StatusRingProps {
  avatarUrl?: string | null;
  displayName: string;
  hasUnviewed?: boolean;
  hasStatus?: boolean;
  isOwn?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  sm: 'w-12 h-12',
  md: 'w-16 h-16',
  lg: 'w-20 h-20',
};

const ringClasses = {
  sm: 'p-0.5',
  md: 'p-[3px]',
  lg: 'p-1',
};

export function StatusRing({
  avatarUrl,
  displayName,
  hasUnviewed = false,
  hasStatus = false,
  isOwn = false,
  size = 'md',
  onClick,
  className,
}: StatusRingProps) {
  const showRing = hasStatus || isOwn;
  
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "relative rounded-full transition-transform active:scale-95",
        showRing && ringClasses[size],
        // Âmbar for new/unviewed, gray for viewed
        showRing && hasUnviewed && "bg-primary",
        showRing && !hasUnviewed && "bg-muted-foreground/30",
        className
      )}
    >
      <Avatar className={cn(
        sizeClasses[size],
        showRing && "border-2 border-background"
      )}>
        <AvatarImage src={avatarUrl || ''} imageVariantSize={160} alt={displayName} />
        <AvatarFallback className="bg-muted text-foreground text-lg">
          {displayName?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      
      {/* Add button for own status - amber */}
      {isOwn && (
        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold border-2 border-background">
          +
        </div>
      )}
    </button>
  );
}
