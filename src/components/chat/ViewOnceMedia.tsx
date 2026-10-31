import { useResolvedMediaUrl } from './MediaPreview';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ViewOnceMediaProps {
  url: string;
  type: 'image' | 'video';
  isViewed: boolean;
  onView: () => Promise<void>;
  isOwn?: boolean;
}

export function ViewOnceMediaBubble({
  url,
  type,
  isViewed,
  onView,
  isOwn = false,
}: ViewOnceMediaProps) {
  const [showMedia, setShowMedia] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const { resolvedUrl } = useResolvedMediaUrl(isOwn || showMedia ? url : '');

  const handleView = async () => {
    if (isOwn || isViewed || isViewing) return;
    
    setIsViewing(true);
    setShowMedia(true);
    await onView();
  };

  const handleClose = () => {
    setShowMedia(false);
    setIsViewing(false);
  };

  // Sent media must never call onView or load a preview in the conversation.
  // isViewed is the current user's receipt, not the recipient's receipt.
  if (isOwn) {
    return (
      <div role="status" className="flex max-w-full items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10">
        <Lock className="w-5 h-5 shrink-0" />
        <div className="text-sm">
          <p>{type === 'image' ? 'Fotografia enviada' : 'Vídeo enviado'}</p>
          <p className="text-xs text-muted-foreground">Visualização única — apenas para o destinatário</p>
        </div>
      </div>
    );
  }

  if (isViewed) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-muted/50">
        <EyeOff className="w-5 h-5 text-muted-foreground" />
        <div className="text-sm">
          <p className="text-muted-foreground italic">View once {type}</p>
          <p className="text-xs text-muted-foreground">Opened</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleView}
        disabled={isViewed}
        className="relative overflow-hidden rounded-2xl w-48 h-48 group"
      >
        {/* Blurred preview for sender */}
        {isOwn ? (
          <div className="w-full h-full relative">
            <img
              src={resolvedUrl}
              alt="View once media"
              className="w-full h-full object-cover blur-md"
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <div className="text-center text-white">
                <Lock className="w-6 h-6 mx-auto mb-2" />
                <p className="text-xs">View once {type}</p>
                {isViewed ? (
                  <p className="text-xs opacity-70 mt-1">Opened</p>
                ) : (
                  <p className="text-xs opacity-70 mt-1">Not opened yet</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-3">
                <Eye className="w-8 h-8 text-primary" />
              </div>
              <p className="text-sm font-medium">View once {type}</p>
              <p className="text-xs text-muted-foreground mt-1">Tap to open</p>
            </div>
          </div>
        )}
      </button>

      {/* Full-screen view for receiver */}
      <AnimatePresence>
        {showMedia && !isOwn && (
          <Dialog open={showMedia} onOpenChange={handleClose}>
            <DialogContent className="max-w-full w-full h-full p-0 bg-black/95">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative w-full h-full flex items-center justify-center"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
                  onClick={handleClose}
                >
                  <X className="w-6 h-6" />
                </Button>

                {type === 'image' ? (
                  <img
                    src={resolvedUrl}
                    alt="View once"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <video
                    src={resolvedUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-full"
                  />
                )}

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white text-center">
                  <p className="text-sm opacity-70">This media will disappear when closed</p>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}

// Toggle for view-once when selecting media
interface ViewOnceToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function ViewOnceToggle({ enabled, onToggle }: ViewOnceToggleProps) {
  return (
    <button
      onClick={() => onToggle(!enabled)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        enabled
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
      }`}
    >
      {enabled ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      {enabled ? 'View once ON' : 'View once'}
    </button>
  );
}
