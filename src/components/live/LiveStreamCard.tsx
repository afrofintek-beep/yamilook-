import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Radio, X, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { LiveSession } from '@/hooks/useLiveStream';

interface LiveStreamCardProps {
  session: LiveSession;
  onClick: () => void;
  canEnd?: boolean;
  onEndSession?: (sessionId: string) => Promise<boolean>;
}

export function LiveStreamCard({ session, onClick, canEnd, onEndSession }: LiveStreamCardProps) {
  useUiLocale();
  const [showEndDialog, setShowEndDialog] = useState(false);
  const [ending, setEnding] = useState(false);

  const handleEndClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEndDialog(true);
  };

  const handleConfirmEnd = async () => {
    if (!onEndSession) return;
    setEnding(true);
    await onEndSession(session.id);
    setEnding(false);
    setShowEndDialog(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="relative overflow-hidden rounded-2xl bg-muted cursor-pointer group"
        onClick={onClick}
      >
        {/* Thumbnail / Placeholder */}
        <div className="aspect-[4/5] relative">
          {session.thumbnail_url ? (
            <img
              src={session.thumbnail_url}
              alt={session.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
              <Radio className="w-12 h-12 text-primary animate-pulse" />
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Live badge */}
          <Badge
            variant="destructive"
            className="absolute top-3 left-3 flex items-center gap-1.5 animate-pulse"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />{uiText("LIVE")}</Badge>

          {/* Viewer count */}
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-1 text-white text-xs">
            <Users className="w-3 h-3" />
            {session.viewer_count}
          </div>

          {/* End button for owner/admin */}
          {canEnd && onEndSession && (
            <Button
              size="icon"
              variant="destructive"
              className="absolute top-10 right-3 w-7 h-7 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleEndClick}
            >
              <X className="w-4 h-4" />
            </Button>
          )}

          {/* Bottom info */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="w-8 h-8 border-2 border-white">
                <AvatarImage src={session.host?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {session.host?.display_name?.[0] || 'H'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {session.host?.display_name || uiText("Anonymous")}
                </p>
                {session.city && (
                  <p className="text-white/70 text-xs truncate">
                    {session.neighborhood ? `${session.neighborhood}, ` : ''}{session.city}
                  </p>
                )}
              </div>
            </div>
            <p className="text-white text-sm font-semibold line-clamp-2">
              {session.title}
            </p>
          </div>
        </div>

        {/* Hover effect */}
        <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      </motion.div>

      <AlertDialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{uiText("End Live Session")}</AlertDialogTitle>
            <AlertDialogDescription>{uiText("Are you sure you want to end \"")}{session.title}{uiText("\"? This will disconnect all viewers.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={ending}>{uiText("Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmEnd}
              disabled={ending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {ending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />{uiText("Ending...")}</>
              ) : (
                uiText("End Session")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
