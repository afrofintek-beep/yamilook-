import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Radio, Shuffle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ActiveStream } from '@/hooks/useActiveStreams';

interface LivePreviewTooltipProps {
  children: React.ReactNode;
  activeStreams: ActiveStream[];
  hasActiveStreams: boolean;
}

export function LivePreviewTooltip({ children, activeStreams, hasActiveStreams }: LivePreviewTooltipProps) {
  useUiLocale();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleJoinRandom = () => {
    if (activeStreams.length > 0) {
      const randomIndex = Math.floor(Math.random() * activeStreams.length);
      navigate(`/live/${activeStreams[randomIndex].id}`);
    }
  };

  if (!hasActiveStreams) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {children}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-card border-border">
            <p className="text-sm text-muted-foreground">
              {t('live.noActiveStreams', 'No one is live right now')}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="w-64 p-0 bg-card border-border shadow-lg"
          sideOffset={8}
        >
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-destructive animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                {t('live.currentlyLive', '{{count}} Live Now', { count: activeStreams.length })}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-primary hover:text-primary"
              onClick={handleJoinRandom}
            >
              <Shuffle className="w-3 h-3 mr-1" />
              {t('live.random', 'Random')}
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {activeStreams.map((stream) => (
              <button
                key={stream.id}
                onClick={() => navigate(`/live/${stream.id}`)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left"
              >
                <Avatar className="h-10 w-10 ring-2 ring-destructive">
                  <AvatarImage src={stream.host?.avatar_url || undefined} />
                  <AvatarFallback className="bg-destructive/10 text-destructive">
                    {stream.host?.display_name?.charAt(0) || 'L'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {stream.host?.display_name || uiText("Unknown")}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {stream.title}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{stream.viewer_count}</span>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-border">
            <button
              onClick={() => navigate('/live')}
              className="w-full text-center text-xs text-primary hover:underline"
            >
              {t('live.viewAll', 'View all streams')}
            </button>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
