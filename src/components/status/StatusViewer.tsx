import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  MoreVertical,
  Trash2,
  VolumeX,
  Volume2,
  Pause,
  Play,
  Music,
  Archive,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useStatus, StatusWithUser, GroupedStatuses, StatusView } from '@/hooks/useStatus';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AFRICAN_REACTIONS, getReactionIcon } from '@/lib/reactions';

interface StatusViewerProps {
  open: boolean;
  onClose: () => void;
  initialGroup: GroupedStatuses | null;
  allGroups: GroupedStatuses[];
  isOwnStatus?: boolean;
}

const STATUS_DURATION = 5000; // 5 seconds per status

export function StatusViewer({
  open,
  onClose,
  initialGroup,
  allGroups,
  isOwnStatus = false,
}: StatusViewerProps) {
  useUiLocale();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { markAsViewed, replyToStatus, reactToStatus, deleteStatus, archiveStatus, getStatusViews, getStatusReactions, getUserReaction, toggleMuteContact } = useStatus();

  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StatusView[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [statusReactions, setStatusReactions] = useState<Awaited<ReturnType<typeof getStatusReactions>>>([]);

  const progressRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Find initial group index
  useEffect(() => {
    if (initialGroup && allGroups.length > 0) {
      const index = allGroups.findIndex(g => g.user_id === initialGroup.user_id);
      if (index !== -1) {
        setCurrentGroupIndex(index);
        // Find first unviewed status
        const firstUnviewed = initialGroup.statuses.findIndex(s => !s.has_viewed);
        setCurrentStatusIndex(firstUnviewed !== -1 ? firstUnviewed : 0);
      }
    }
  }, [initialGroup, allGroups]);

  const currentGroup = allGroups[currentGroupIndex];
  const currentStatus = currentGroup?.statuses[currentStatusIndex];

  // Mark as viewed and fetch user's reaction when status changes
  useEffect(() => {
    if (currentStatus && !isOwnStatus && !currentStatus.has_viewed) {
      markAsViewed(currentStatus.id);
    }
    // Fetch user's current reaction
    if (currentStatus && !isOwnStatus) {
      getUserReaction(currentStatus.id).then(setUserReaction);
    }
    // Reset reaction when status changes
    setUserReaction(null);
  }, [currentStatus?.id, isOwnStatus, markAsViewed, getUserReaction]);

  // Progress timer
  useEffect(() => {
    if (!open || isPaused || !currentStatus) return;

    const duration = currentStatus.type === 'video' ? 15000 : STATUS_DURATION;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);

      if (newProgress >= 100) {
        goToNext();
      } else {
        progressRef.current = requestAnimationFrame(animate);
      }
    };

    progressRef.current = requestAnimationFrame(animate);

    return () => {
      if (progressRef.current) {
        cancelAnimationFrame(progressRef.current);
      }
    };
  }, [open, isPaused, currentStatus?.id, currentGroupIndex, currentStatusIndex]);

  const goToNext = useCallback(() => {
    if (!currentGroup) return;

    if (currentStatusIndex < currentGroup.statuses.length - 1) {
      setCurrentStatusIndex(prev => prev + 1);
      setProgress(0);
    } else if (currentGroupIndex < allGroups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
      setCurrentStatusIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentGroup, currentGroupIndex, currentStatusIndex, allGroups.length, onClose]);

  const goToPrev = useCallback(() => {
    if (currentStatusIndex > 0) {
      setCurrentStatusIndex(prev => prev - 1);
      setProgress(0);
    } else if (currentGroupIndex > 0) {
      setCurrentGroupIndex(prev => prev - 1);
      const prevGroup = allGroups[currentGroupIndex - 1];
      setCurrentStatusIndex(prevGroup.statuses.length - 1);
      setProgress(0);
    }
  }, [currentGroupIndex, currentStatusIndex, allGroups]);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const isLeft = x < rect.width / 3;
    const isRight = x > (rect.width * 2) / 3;

    if (isLeft) {
      goToPrev();
    } else if (isRight) {
      goToNext();
    } else {
      setIsPaused(prev => !prev);
    }
  };

  const handleSwipe = (e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.y) > 100) {
      onClose();
    } else if (info.offset.x > 100) {
      if (currentGroupIndex > 0) {
        setCurrentGroupIndex(prev => prev - 1);
        setCurrentStatusIndex(0);
        setProgress(0);
      }
    } else if (info.offset.x < -100) {
      if (currentGroupIndex < allGroups.length - 1) {
        setCurrentGroupIndex(prev => prev + 1);
        setCurrentStatusIndex(0);
        setProgress(0);
      }
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !currentStatus) return;
    await replyToStatus(currentStatus.id, replyText.trim());
    setReplyText('');
    toast.success(t('status.replySent'));
  };

  const handleReaction = async (reactionType: string) => {
    if (!currentStatus) return;
    await reactToStatus(currentStatus.id, reactionType);
    setUserReaction(prev => prev === reactionType ? null : reactionType);
    setShowReactions(false);
    if (userReaction !== reactionType) {
      toast.success(t('status.reactionSent'));
    }
  };

  const handleShowReactions = () => {
    setShowReactions(true);
    setIsPaused(true);
  };

  const handleShowViewers = async () => {
    if (!currentStatus) return;
    const data = await getStatusViews(currentStatus.id);
    setViewers(data);
    setShowViewers(true);
    setIsPaused(true);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
    setIsPaused(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentStatus || !currentGroup) return;

    const statusToDelete = currentStatus;
    const wasLastStatus = currentGroup.statuses.length === 1;

    // Close dialog first
    setShowDeleteConfirm(false);

    // Navigate away before showing toast
    if (wasLastStatus) {
      onClose();
    } else {
      goToNext();
    }

    // Show toast with undo option - delay actual deletion
    const UNDO_TIMEOUT = 10000; // 10 seconds to undo
    let isUndone = false;

    const toastId = toast(t('status.statusDeleted'), {
      description: t('status.undoDeleteDescription'),
      action: {
        label: t('status.undo'),
        onClick: () => {
          isUndone = true;
          toast.success(t('status.deleteUndone'));
        },
      },
      duration: UNDO_TIMEOUT,
      onDismiss: async () => {
        // Only delete if not undone
        if (!isUndone) {
          await deleteStatus(statusToDelete.id);
        }
      },
      onAutoClose: async () => {
        // Only delete if not undone
        if (!isUndone) {
          await deleteStatus(statusToDelete.id);
        }
      },
    });
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setIsPaused(false);
  };

  const handleArchive = async () => {
    if (!currentStatus) return;
    await archiveStatus(currentStatus.id);
    if (currentGroup.statuses.length === 1) {
      onClose();
    } else {
      goToNext();
    }
  };

  const handleMuteContact = async () => {
    if (!currentGroup) return;
    await toggleMuteContact(currentGroup.user_id);
    onClose();
  };

  if (!currentStatus || !currentGroup) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black"
        >
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={handleSwipe}
            className="h-full w-full"
          >
            {/* Progress bars */}
            <div className="absolute top-0 left-0 right-0 z-20 flex gap-1.5 px-3 pt-4 pb-2">
              {currentGroup.statuses.map((status, index) => (
                <div key={status.id} className="flex-1 h-1 bg-white/40 rounded-full overflow-hidden shadow-sm">
                  <motion.div
                    className="h-full bg-white rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: index < currentStatusIndex ? '100%' :
                             index === currentStatusIndex ? `${progress}%` : '0%'
                    }}
                    transition={{ duration: 0.1, ease: 'linear' }}
                  />
                </div>
              ))}
            </div>

            {/* Header gradient overlay */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/60 via-black/30 to-transparent z-10 pointer-events-none" />

            {/* Header */}
            <div className="absolute top-16 left-0 right-0 z-20 flex items-center justify-between px-4 safe-top">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10 border-2 border-white">
                  <AvatarImage src={currentGroup.user.avatar_url || ''} />
                  <AvatarFallback className="bg-gradient-primary text-white">
                    {currentGroup.user.display_name?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-white font-semibold text-sm">
                    {isOwnStatus ? t('status.yourStatus') : currentGroup.user.display_name}
                  </p>
                  <p className="text-white/70 text-xs">
                    {formatDistanceToNow(new Date(currentStatus.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentStatus.music_title && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsMuted(prev => !prev)}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setIsPaused(prev => !prev)}
                >
                  {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isOwnStatus ? (
                      <>
                        <DropdownMenuItem onClick={handleArchive}>
                          <Archive className="w-4 h-4 mr-2" />
                          {t('status.archive')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDeleteClick} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t('status.delete')}
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem onClick={handleMuteContact}>
                        <VolumeX className="w-4 h-4 mr-2" />
                        {t('status.mute')} {currentGroup.user.display_name}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={onClose}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Status content */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              onClick={handleTap}
            >
              {currentStatus.type === 'text' ? (
                <div
                  className="w-full h-full flex items-center justify-center p-8"
                  style={{
                    background: currentStatus.background || 'linear-gradient(135deg, hsl(var(--primary)), hsl(280, 100%, 60%))'
                  }}
                >
                  <p className="text-white text-2xl font-bold text-center leading-relaxed">
                    {currentStatus.content}
                  </p>
                </div>
              ) : currentStatus.type === 'photo' ? (
                <img
                  src={currentStatus.media_url || ''}
                  alt={uiText("Status")}
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={currentStatus.media_url || ''}
                  className="w-full h-full object-contain"
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                />
              )}

              {/* Caption */}
              {currentStatus.caption && (
                <div className="absolute bottom-24 left-4 right-4">
                  <p className="text-white text-center bg-black/40 px-4 py-2 rounded-xl backdrop-blur-sm">
                    {currentStatus.caption}
                  </p>
                </div>
              )}

              {/* Music indicator */}
              {currentStatus.music_title && (
                <div className="absolute bottom-36 left-4 right-4">
                  <div className="flex items-center justify-center gap-2 text-white bg-black/40 px-4 py-2 rounded-xl backdrop-blur-sm">
                    <Music className="w-4 h-4" />
                    <span className="text-sm">{currentStatus.music_title}</span>
                  </div>
                  {currentStatus.music_url && (
                    <audio
                      ref={audioRef}
                      src={currentStatus.music_url}
                      autoPlay
                      loop
                      muted={isMuted}
                    />
                  )}
                </div>
              )}
            </div>

            {/* Navigation arrows */}
            {currentGroupIndex > 0 && (
              <button
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/50 hover:text-white"
                onClick={(e) => { e.stopPropagation(); goToPrev(); }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}
            {currentGroupIndex < allGroups.length - 1 && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/50 hover:text-white"
                onClick={(e) => { e.stopPropagation(); goToNext(); }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}

            {/* Bottom actions */}
            <div className="absolute bottom-0 left-0 right-0 p-4 safe-bottom">
              {isOwnStatus ? (
                <Button
                  variant="ghost"
                  className="w-full text-white hover:bg-white/20"
                  onClick={handleShowViewers}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {currentStatus.view_count} {t('status.views')}
                </Button>
              ) : (
                <div className="space-y-3">
                  {/* Reaction buttons */}
                  <div className="flex items-center justify-center gap-2">
                    {AFRICAN_REACTIONS.map((reaction) => (
                      <motion.button
                        key={reaction.type}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleReaction(reaction.type)}
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all",
                          userReaction === reaction.type
                            ? "bg-primary/30 ring-2 ring-primary"
                            : "bg-white/10 hover:bg-white/20"
                        )}
                        title={reaction.label}
                      >
                        {reaction.icon}
                      </motion.button>
                    ))}
                  </div>

                  {/* Reply input */}
                  <div className="flex gap-2">
                    <Input
                      placeholder={t('status.reply')}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onFocus={() => setIsPaused(true)}
                      onBlur={() => setIsPaused(false)}
                      className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                    />
                    <Button
                      size="icon"
                      className="bg-white/20 hover:bg-white/30"
                      onClick={handleReply}
                      disabled={!replyText.trim()}
                    >
                      <Send className="w-4 h-4 text-white" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Viewers sheet */}
          <Sheet open={showViewers} onOpenChange={(open) => { setShowViewers(open); if (!open) setIsPaused(false); }}>
            <SheetContent side="bottom" className="h-[60vh] rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>{t('status.viewedBy')} {viewers.length}</SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(60vh-80px)] mt-4">
                <div className="space-y-2">
                  {viewers.map((viewer) => (
                    <div key={viewer.viewer_id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50">
                      <Avatar>
                        <AvatarImage src={viewer.viewer?.avatar_url || ''} />
                        <AvatarFallback className="bg-gradient-primary text-white">
                          {viewer.viewer?.display_name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{viewer.viewer?.display_name || uiText("Unknown")}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(viewer.viewed_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {viewers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      {t('status.noViewsYet')}
                    </p>
                  )}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Delete confirmation dialog */}
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('status.deleteConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('status.deleteConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleCancelDelete}>
                  {t('common.cancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t('status.delete')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
