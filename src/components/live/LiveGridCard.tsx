import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { Eye, PhoneOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LiveSession } from '@/hooks/useLiveStream';

interface LiveGridCardProps {
  session: LiveSession;
  onClick: () => void;
  isLarge?: boolean;
  /** True when the logged-in user is the host of this live. */
  isOwnLive?: boolean;
  /** Called when the host taps "Terminar" on their own live. */
  onEnd?: () => void;
}

export function LiveGridCard({ session, onClick, isLarge = false, isOwnLive = false, onEnd }: LiveGridCardProps) {
  useUiLocale();
  return (
    <div className={`relative ${isLarge ? 'row-span-2 col-span-2' : ''}`}>
      <button
        onClick={onClick}
        className="relative overflow-hidden rounded-xl bg-card border border-border/30 group text-left w-full transition-transform active:scale-[0.97]"
      >
        <div className={`relative ${isLarge ? 'aspect-[4/5]' : 'aspect-square'}`}>
          {/* Background */}
          {session.thumbnail_url ? (
            <img
              src={session.thumbnail_url}
              alt={session.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-card to-muted flex items-center justify-center">
              <Avatar className={`${isLarge ? 'w-24 h-24' : 'w-14 h-14'} ring-2 ring-destructive`}>
                <AvatarImage src={session.host?.avatar_url || ''} />
                <AvatarFallback className={`${isLarge ? 'text-2xl' : 'text-base'} bg-muted`}>
                  {session.host?.display_name?.[0] || 'G'}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

          {/* Viewer count badge */}
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-1.5 py-0.5">
            <Eye className="w-3 h-3 text-primary" />
            <span className="text-white text-[11px] font-medium">
              {session.viewer_count}
            </span>
          </div>

          {/* Guia label for host (large card only) — hidden when we show the Terminar button */}
          {isLarge && !isOwnLive && (
            <Badge className="absolute top-2 right-2 bg-primary/90 text-primary-foreground text-[10px] px-1.5 py-0.5 border-0">{uiText("Guia")}</Badge>
          )}

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-2">
            <p className="text-white text-xs font-medium truncate">
              {session.host?.display_name || uiText("Anónimo")}
            </p>
            {isLarge && session.title && (
              <p className="text-white/70 text-[10px] truncate mt-0.5">
                {session.title}
              </p>
            )}
            {session.city && (
              <p className="text-white/50 text-[10px] truncate">
                {session.neighborhood || session.city}
              </p>
            )}
          </div>
        </div>

        {/* Hover effect */}
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </button>

      {/* Host-only: end your own live directly from the list */}
      {isOwnLive && onEnd && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEnd(); }}
          aria-label={uiText("Terminar a minha live")}
          className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1 bg-destructive text-destructive-foreground rounded-full pl-1.5 pr-2 py-1 text-[10px] font-semibold shadow-lg hover:bg-destructive/90 active:scale-95 transition"
        >
          <PhoneOff className="w-3 h-3" />{uiText("Terminar")}</button>
      )}
    </div>
  );
}
