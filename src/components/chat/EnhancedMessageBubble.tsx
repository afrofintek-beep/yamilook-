import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { 
  Check, 
  CheckCheck, 
  MoreVertical, 
  Trash2, 
  Copy, 
  Reply, 
  Star, 
  Pin,
  Forward,
  Edit2,
  Highlighter
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { ReactionPicker, ReactionDisplay } from './ReactionPicker';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { MediaThumbnail, MediaPreview } from './MediaPreview';
import { ViewOnceMediaBubble } from './ViewOnceMedia';
import { ReplyPreview } from './ReplyPreview';
import { parseFormattedText } from './MessageFormatting';
import { MessageHighlightPicker, HighlightBadge, getHighlightClass } from './MessageHighlight';
import { MessageActionsSheet } from './MessageActionsSheet';
import { cn } from '@/lib/utils';
import { mediaCaption } from '@/lib/chat-media';

interface Reaction {
  emoji: string;
  count: number;
  users: string[];
}

export interface BubbleMessage {
  id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  thumbnail_url?: string | null;
  is_deleted: boolean;
  is_edited: boolean;
  created_at: string;
  sender_id: string;
  reply_to_id: string | null;
  duration_seconds?: number;
  is_view_once?: boolean;
  forwarded_from_id?: string | null;
  delivered_at?: string | null;
  read_by?: unknown;
  sender_profile?: {
    id: string;
    display_name: string;
    username: string;
    avatar_url: string | null;
  };
  reply_to?: {
    id: string;
    content: string | null;
    message_type: string;
    sender_profile?: {
      display_name: string;
      avatar_url: string | null;
    };
  };
}

interface EnhancedMessageBubbleProps {
  message: BubbleMessage;
  reactions: Reaction[];
  isOwn: boolean;
  isStarred: boolean;
  isPinned: boolean;
  highlight?: { color: string; label?: string };
  showAvatar?: boolean;
  isGroupChat?: boolean;
  currentUserId: string;
  onDelete?: (id: string) => Promise<void>;
  onReply?: (message: BubbleMessage) => void;
  onReact?: (messageId: string, emoji: string) => Promise<void>;
  onStar?: (messageId: string) => Promise<void>;
  onPin?: (messageId: string) => Promise<void>;
  onHighlight?: (color: string, label?: string) => Promise<void>;
  onRemoveHighlight?: () => Promise<void>;
  onViewOnce?: (messageId: string) => Promise<void>;
  viewOnceViewed?: boolean;
  // Multi-select props
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onLongPressSelect?: () => void;
  // Privacy settings
  showReadReceipts?: boolean;
}

export function EnhancedMessageBubble({
  message,
  reactions,
  isOwn,
  isStarred,
  isPinned,
  highlight,
  showAvatar = true,
  isGroupChat = false,
  currentUserId,
  onDelete,
  onReply,
  onReact,
  onStar,
  onPin,
  onHighlight,
  onRemoveHighlight,
  onViewOnce,
  viewOnceViewed = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onLongPressSelect,
  showReadReceipts = true,
}: EnhancedMessageBubbleProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [showActionsSheet, setShowActionsSheet] = useState(false);
  
  // Long press handling
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  
  // Swipe to reply
  const x = useMotionValue(0);
  const replyIconOpacity = useTransform(x, [0, 40, 60], [0, 0.5, 1]);
  const replyIconScale = useTransform(x, [0, 40, 60], [0.3, 0.7, 1]);
  const replyTriggered = useRef(false);

  const displayName = message.sender_profile?.display_name || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast({ title: 'Copiado' });
    }
  };

  const handleReaction = async (emoji: string) => {
    setShowReactionPicker(false);
    if (onReact) {
      await onReact(message.id, emoji);
    }
  };

  // Touch handlers for long press
  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      // If selection mode is active, toggle selection. Otherwise show actions sheet with reactions.
      if (selectionMode) {
        onToggleSelect?.();
      } else {
        // Always show actions sheet first (which contains African reactions)
        setShowActionsSheet(true);
      }
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 400); // Reduced to 400ms for better responsiveness
  }, [selectionMode, onToggleSelect]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Mouse handlers for desktop long press
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent context menu
    e.preventDefault();
    handleTouchStart(e);
  }, [handleTouchStart]);

  const handleMouseUp = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  const handleMouseLeave = useCallback(() => {
    handleTouchEnd();
  }, [handleTouchEnd]);

  // Context menu handler for right-click on desktop
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectionMode) {
      setShowActionsSheet(true);
    }
  }, [selectionMode]);

  // Swipe to reply handler
  const handleDrag = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Trigger haptic feedback when threshold is reached
    if (info.offset.x > 50 && !replyTriggered.current) {
      replyTriggered.current = true;
      if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } else if (info.offset.x <= 50) {
      replyTriggered.current = false;
    }
  }, []);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x > 50 && onReply) {
      onReply(message);
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
    replyTriggered.current = false;
  }, [message, onReply]);

  if (message.is_deleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex gap-2 px-4 py-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
      >
        {!isOwn && showAvatar && <div className="w-8" />}
        <div className="px-4 py-2 rounded-2xl bg-muted/50 italic text-muted-foreground text-sm">
          This message was deleted
        </div>
      </motion.div>
    );
  }

  const renderContent = () => {
    // View-once media (image or video)
    if (message.is_view_once && (message.message_type === 'image' || message.message_type === 'video')) {
      return (
        <ViewOnceMediaBubble
          url={message.media_url || ''}
          type={message.message_type as 'image' | 'video'}
          isViewed={viewOnceViewed}
          isOwn={isOwn}
          onView={async () => {
            if (onViewOnce) await onViewOnce(message.id);
          }}
        />
      );
    }

    switch (message.message_type) {
      case 'voice':
        return (
          <VoiceMessagePlayer
            url={message.media_url || ''}
            duration={message.duration_seconds}
            isOwn={isOwn}
          />
        );
      case 'image':
        return (
          <>
            <MediaThumbnail
              url={message.media_url || ''}
              type="image"
              onClick={() => { if (!selectionMode) setShowMediaPreview(true); }}
            />
            {mediaCaption(message.content, message.media_url) && (
              <p className="text-sm mt-2">{parseFormattedText(message.content)}</p>
            )}
          </>
        );
      case 'video':
        return (
          <>
            <MediaThumbnail
              url={message.media_url || ''}
              type="video"
              posterUrl={message.thumbnail_url}
              durationSeconds={message.duration_seconds}
              onClick={() => { if (!selectionMode) setShowMediaPreview(true); }}
            />
            {mediaCaption(message.content, message.media_url) && (
              <p className="text-sm mt-2">{parseFormattedText(message.content)}</p>
            )}
          </>
        );
      case 'sticker':
        return (
          <img
            src={message.media_url || ''}
            alt="Sticker"
            className="w-32 h-32 object-contain"
          />
        );
      case 'gif':
        return (
          <img
            src={message.media_url || ''}
            alt="GIF"
            className="max-w-[200px] rounded-lg"
          />
        );
      case 'file':
        return (
          <a
            href={message.media_url || ''}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm underline"
          >
            📎 {message.content || 'File'}
          </a>
        );
      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content ? parseFormattedText(message.content) : null}
          </p>
        );
    }
  };

  return (
    <>
      {/* Swipe to reply container */}
      <div className="relative overflow-hidden touch-pan-y">
        {/* Reply icon indicator */}
        <motion.div
          className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 z-0"
          style={{ opacity: replyIconOpacity, scale: replyIconScale }}
        >
          <Reply className="w-5 h-5 text-primary" />
        </motion.div>

        <motion.div
          drag={selectionMode || !onReply ? false : "x"}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 80 }}
          dragElastic={{ left: 0, right: 0.5 }}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          style={{ x: selectionMode || !onReply ? undefined : x }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'flex gap-2 px-4 py-1 group relative z-10 select-none',
            isOwn ? 'justify-end' : 'justify-start',
            highlight && getHighlightClass(highlight.color),
            // Transparent at rest so the chat wallpaper shows through uniformly
            // (an opaque bg-background here banded over the wallpaper). The
            // swipe-to-reply icon is occluded by its own opacity, not this.
            isSelected ? 'bg-primary/10' : 'bg-transparent'
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
          onClick={selectionMode ? onToggleSelect : undefined}
        >
          {/* Selection checkbox */}
          {selectionMode && (
            <div className="flex items-center mr-1">
              <div 
                className={cn(
                  'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                  isSelected 
                    ? 'bg-primary border-primary' 
                    : 'border-muted-foreground/50'
                )}
              >
                {isSelected && (
                  <Check className="w-4 h-4 text-primary-foreground" />
                )}
              </div>
            </div>
          )}

          {!isOwn && showAvatar && !selectionMode && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${message.sender_id}`);
              }}
              className="focus:outline-none"
            >
              <Avatar className="w-8 h-8 mt-auto cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
                <AvatarImage src={message.sender_profile?.avatar_url || ''} />
                <AvatarFallback className="text-xs bg-secondary">{initials}</AvatarFallback>
              </Avatar>
            </button>
          )}
          {!isOwn && !showAvatar && !selectionMode && <div className="w-8" />}

          <div className={`flex flex-col min-w-0 max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
          {isGroupChat && !isOwn && showAvatar && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${message.sender_id}`);
              }}
              className="text-xs text-muted-foreground mb-1 ml-1 hover:text-primary hover:underline transition-colors focus:outline-none text-left"
            >
              {displayName}
            </button>
          )}

          {/* Forwarded indicator */}
          {message.forwarded_from_id && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Forward className="w-3 h-3" />
              Forwarded
            </div>
          )}

          {/* Highlight badge */}
          {highlight && (
            <div className="mb-1">
              <HighlightBadge color={highlight.color} label={highlight.label} />
            </div>
          )}

          {/* Reply preview */}
          {message.reply_to && (
            <div className="mb-1 w-full">
              <ReplyPreview message={message.reply_to} compact />
            </div>
          )}

          <div className="relative">
            <div className="flex items-end gap-1">
              {isOwn && (
                <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                  >
                    😊
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onReply?.(message)}>
                        <Reply className="w-4 h-4 mr-2" />
                        Reply
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCopy}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStar?.(message.id)}>
                        <Star className={`w-4 h-4 mr-2 ${isStarred ? 'fill-warning text-warning' : ''}`} />
                        {isStarred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onPin?.(message.id)}>
                        <Pin className={`w-4 h-4 mr-2 ${isPinned ? 'fill-primary text-primary' : ''}`} />
                        {isPinned ? 'Unpin' : 'Pin'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {onHighlight && (
                        <div className="px-2 py-1.5">
                          <MessageHighlightPicker
                            messageId={message.id}
                            currentColor={highlight?.color}
                            currentLabel={highlight?.label}
                            onHighlight={onHighlight}
                            onRemove={onRemoveHighlight || (async () => {})}
                          />
                        </div>
                      )}
                      <DropdownMenuSeparator />
                      {onDelete && (
                        <DropdownMenuItem onClick={() => onDelete(message.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <div
                className={`px-4 py-2 rounded-2xl ${
                  message.message_type === 'sticker' || message.message_type === 'gif'
                    ? ''
                    : isOwn
                    ? 'bubble-sent rounded-br-md'
                    : 'bubble-received rounded-bl-md'
                }`}
              >
                {isPinned && (
                  <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                    <Pin className="w-3 h-3" />
                    Pinned
                  </div>
                )}
                {renderContent()}
              </div>

              {!isOwn && (
                <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setShowReactionPicker(!showReactionPicker)}
                  >
                    😊
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => onReply?.(message)}>
                        <Reply className="w-4 h-4 mr-2" />
                        Reply
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCopy}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onStar?.(message.id)}>
                        <Star className={`w-4 h-4 mr-2 ${isStarred ? 'fill-warning text-warning' : ''}`} />
                        {isStarred ? 'Unstar' : 'Star'}
                      </DropdownMenuItem>
                      {onHighlight && (
                        <>
                          <DropdownMenuSeparator />
                          <div className="px-2 py-1.5">
                            <MessageHighlightPicker
                              messageId={message.id}
                              currentColor={highlight?.color}
                              currentLabel={highlight?.label}
                              onHighlight={onHighlight}
                              onRemove={onRemoveHighlight || (async () => {})}
                            />
                          </div>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>

            <AnimatePresence>
              {showReactionPicker && (
                <ReactionPicker
                  onSelect={handleReaction}
                  onClose={() => setShowReactionPicker(false)}
                  position={isOwn ? 'top' : 'top'}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Reactions */}
          <ReactionDisplay
            reactions={reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) => handleReaction(emoji)}
          />

          {/* Timestamp and status */}
          <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'mr-1' : 'ml-1'}`}>
            {isStarred && <Star className="w-3 h-3 fill-warning text-warning" />}
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(message.created_at), 'h:mm a')}
            </span>
            {message.is_edited && (
              <span className="text-[10px] text-muted-foreground italic">edited</span>
            )}
            {isOwn && showReadReceipts && (
              Array.isArray(message.read_by) && message.read_by.length > 0 ? (
                <CheckCheck className="w-3.5 h-3.5 text-primary" />
              ) : message.delivered_at || !message.id.startsWith('temp-') ? (
                <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <Check className="w-3.5 h-3.5 text-muted-foreground" />
              )
            )}
            {isOwn && !showReadReceipts && (
              // Show single check when read receipts are disabled
              <Check className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        </motion.div>
      </div>

      {/* Mobile actions sheet */}
      <MessageActionsSheet
        open={showActionsSheet}
        onOpenChange={setShowActionsSheet}
        messageContent={message.content || undefined}
        isOwn={isOwn}
        isStarred={isStarred}
        isPinned={isPinned}
        highlight={highlight}
        onReply={() => onReply?.(message)}
        onCopy={handleCopy}
        onReact={(emoji) => handleReaction(emoji)}
        onStar={() => onStar?.(message.id)}
        onPin={() => onPin?.(message.id)}
        onDelete={onDelete ? () => onDelete(message.id) : undefined}
        onHighlight={onHighlight}
        onRemoveHighlight={onRemoveHighlight}
      />

      {/* Media preview modal */}
      {(message.message_type === 'image' || message.message_type === 'video') && message.media_url && (
        <MediaPreview
          url={message.media_url}
          type={message.message_type as 'image' | 'video'}
          posterUrl={message.thumbnail_url}
          open={showMediaPreview}
          onClose={() => setShowMediaPreview(false)}
        />
      )}
    </>
  );
}
