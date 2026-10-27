import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReportContentSheet } from '@/components/moderation/ReportContentSheet';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import {
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Megaphone,
  MapPin,
  Trash2,
  Pencil,
  Flag,
  Link,
  Send,
  Play,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { PostWithUser, usePosts } from '@/hooks/usePosts';
import { EditPostSheet } from './EditPostSheet';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { chooseAuthorAvatarUrl } from '@/lib/avatar-source';
import { 
  AfricanReactionType, 
  getReaction,
  ReactionCounts,
  getTotalReactions,
  createEmptyReactionCounts,
  normalizeReactionType,
} from '@/lib/reactions';
import { AfricanReactionPicker } from './AfricanReactionPicker';
import { ReactionDisplay } from './ReactionDisplay';
import { MediaCarousel } from './MediaCarousel';

interface PostCardProps {
  post: PostWithUser;
  mediaPriority?: boolean;
  onCommentClick?: () => void;
  isArchived?: boolean;
  onToggleArchive?: (postId: string) => void;
}

export const PostCard = memo(function PostCard({ mediaPriority = false, post, onCommentClick, isArchived, onToggleArchive }: PostCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile: currentProfile } = useAuth();
  const { toggleLike, toggleSave, deletePost, sharePost, updatePost } = usePosts({ autoLoad: false });
  const { toast } = useToast();
  
  const [showReactions, setShowReactions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  
  // Long-press handling for mobile reaction picker
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  
  // Optimistic local state
  const [localLiked, setLocalLiked] = useState(post.is_liked);
  const [localReaction, setLocalReaction] = useState<string | null>(
    normalizeReactionType(post.my_reaction) || post.my_reaction
  );
  const [localReactionCounts, setLocalReactionCounts] = useState<ReactionCounts>(post.reaction_counts || createEmptyReactionCounts());
  const [localSaved, setLocalSaved] = useState(post.is_saved);
  const [localCommentsCount, setLocalCommentsCount] = useState(post.comments_count);

  // Sync local state with props when they change (e.g., after refetch)
  useEffect(() => {
    setLocalReactionCounts(post.reaction_counts || createEmptyReactionCounts());
    setLocalLiked(post.is_liked);
    setLocalReaction(normalizeReactionType(post.my_reaction) || post.my_reaction);
    setLocalSaved(post.is_saved);
  }, [post.reaction_counts, post.is_liked, post.my_reaction, post.is_saved]);

  // Calculate totals
  const totalReactions = getTotalReactions(localReactionCounts);

  const isOwner = user?.id === post.user_id;
  // Reuse the signed-in profile for own posts. Others remain public-RPC only.
  const authorAvatarUrl = chooseAuthorAvatarUrl(
    post.user_id, post.user.avatar_url, user?.id, currentProfile
  );

  const handleReact = useCallback((reactionType: AfricanReactionType) => {
    setIsLikeAnimating(true);
    setShowReactions(false);
    
    // Optimistic update for reaction counts
    setLocalReactionCounts(prev => {
      const newCounts = { ...prev };
      
      if (localLiked) {
        if (localReaction === reactionType) {
          // Toggle off same reaction
          newCounts[reactionType] = Math.max(0, (newCounts[reactionType] || 0) - 1);
          setLocalLiked(false);
          setLocalReaction(null);
        } else {
          // Change to different reaction
          if (localReaction && localReaction in newCounts) {
            newCounts[localReaction as keyof ReactionCounts] = Math.max(0, (newCounts[localReaction as keyof ReactionCounts] || 0) - 1);
          }
          newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
          setLocalReaction(reactionType);
        }
      } else {
        // New reaction
        newCounts[reactionType] = (newCounts[reactionType] || 0) + 1;
        setLocalLiked(true);
        setLocalReaction(reactionType);
      }
      
      return newCounts;
    });
    
    // Fire and forget - don't await
    toggleLike(post.id, reactionType);
    setTimeout(() => setIsLikeAnimating(false), 300);
  }, [localLiked, localReaction, post.id, toggleLike]);

  const handleQuickReact = useCallback(() => {
    // Default to Sankofa (highest priority) or toggle off current
    const normalizedCurrent = normalizeReactionType(localReaction) || 'sankofa';

    if (localLiked) {
      handleReact(normalizedCurrent);
    } else {
      handleReact('sankofa');
    }
  }, [localLiked, localReaction, handleReact]);

  // Long-press handlers for reaction picker on mobile
  const handleTouchStart = useCallback(() => {
    isLongPressRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowReactions(true);
    }, 400);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    // If it wasn't a long press, do quick react
    if (!isLongPressRef.current && !showReactions) {
      handleQuickReact();
    }
  }, [showReactions, handleQuickReact]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const handleDoubleTap = () => {
    if (!localLiked) {
      handleReact('sankofa');
    }
  };

  const handleSave = async () => {
    const wasSaved = localSaved;
    setLocalSaved(!wasSaved);
    toast({
      title: wasSaved ? t('feed.removedFromSaved') : t('feed.saved'),
      description: wasSaved ? t('feed.postRemoved') : t('feed.postAdded'),
    });
    try {
      await toggleSave(post.id);
    } catch {
      // Revert on failure
      setLocalSaved(wasSaved);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    toast({
      title: t('feed.linkCopied'),
      description: t('feed.linkCopiedDesc'),
    });
    sharePost(post.id, 'message');
  };

  const handleDelete = async () => {
    await deletePost(post.id);
    toast({
      title: t('feed.postDeleted'),
      description: t('feed.postDeletedDesc'),
    });
  };

  const currentReaction = localReaction ? getReaction(localReaction) : null;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border-b border-border overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 relative z-10 bg-card">
        <div 
          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
          onClick={() => navigate(`/profile/${post.user_id}`)}
        >
          <Avatar className="w-10 h-10 flex-shrink-0">
            <AvatarImage src={authorAvatarUrl || ''} imageVariantSize={160} />
            <AvatarFallback className="bg-gradient-primary text-white">
              {post.user.display_name?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{post.user.display_name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className="flex-shrink-0">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
              {post.location && (
                <>
                  <span>•</span>
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{post.location}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleShare}>
              <Link className="w-4 h-4 mr-2" />
              {t('feed.copyLink')}
            </DropdownMenuItem>
            {onToggleArchive && (
              <DropdownMenuItem onClick={() => onToggleArchive(post.id)}>
                {isArchived ? (
                  <>
                    <ArchiveRestore className="w-4 h-4 mr-2" />
                    Desarquivar
                  </>
                ) : (
                  <>
                    <Archive className="w-4 h-4 mr-2" />
                    Arquivar
                  </>
                )}
              </DropdownMenuItem>
            )}
            {isOwner ? (
              <>
                <DropdownMenuItem onClick={() => navigate(`/advertising?promote=${post.id}`)}>
                  <Megaphone className="w-4 h-4 mr-2" />
                  {t('feed.promotePost', 'Promover')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowEdit(true)}>
                  <Pencil className="w-4 h-4 mr-2" />
                  {t('feed.editPost', 'Editar publicação')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" />
                  {t('feed.deletePost')}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => setShowReport(true)}>
                <Flag className="w-4 h-4 mr-2" />
                {t('feed.report')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-sm whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Topic Badges */}
      {post.topics && post.topics.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {post.topics.map((topic) => (
            <Badge
              key={topic.id}
              variant="secondary"
              className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors text-xs"
              onClick={() => navigate(`/discover?topic=${topic.id}`)}
            >
              #{topic.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Media — swipeable carousel for multiple items */}
      {post.media_urls && post.media_urls.length > 0 && (
        <MediaCarousel
          urls={post.media_urls}
          priority={mediaPriority}
          onDoubleTap={handleDoubleTap}
          likeOverlay={
            isLikeAnimating && currentReaction ? (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.2, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
              >
                <span className="text-7xl drop-shadow-lg" role="img" aria-hidden="true">
                  {currentReaction.icon}
                </span>
              </motion.div>
            ) : null
          }
        />
      )}

      {/* Reaction Summary - uses ReactionDisplay component */}
      {totalReactions > 0 && (
        <div className="px-4 pb-2">
          <ReactionDisplay 
            counts={localReactionCounts} 
            myReaction={localReaction}
            size="sm"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Reaction button with African reactions */}
          <div 
            className="relative"
            onMouseEnter={() => setShowReactions(true)}
            onMouseLeave={() => setShowReactions(false)}
          >
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-2 px-2"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchCancel}
              onClick={(e) => {
                // On desktop, single click toggles default reaction
                // Touch is handled separately
                if (e.detail > 0 && !('ontouchstart' in window)) {
                  handleQuickReact();
                }
              }}
            >
              {localLiked && currentReaction ? (
                <motion.span
                  key={localReaction}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-xl"
                  role="img"
                  aria-label={currentReaction.label}
                >
                  {currentReaction.icon}
                </motion.span>
              ) : (
                <span className="text-xl" role="img" aria-label="React">💛</span>
              )}
            </Button>

            {/* African Reaction picker */}
            <AnimatePresence>
              {showReactions && (
                <AfricanReactionPicker
                  myReaction={localReaction}
                  onReact={handleReact}
                  onClose={() => setShowReactions(false)}
                  position="top"
                />
              )}
            </AnimatePresence>
          </div>

          {/* Comment button */}
          <Button 
            variant="ghost" 
            size="sm"
            className="gap-2 px-2"
            onClick={onCommentClick}
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{localCommentsCount || ''}</span>
          </Button>

          {/* Share button */}
          <Button 
            variant="ghost" 
            size="sm"
            className="gap-2 px-2"
            onClick={handleShare}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>

        {/* Save button */}
        <Button 
          variant="ghost" 
          size="sm"
          className="px-2"
          onClick={handleSave}
        >
          <Bookmark className={cn("w-5 h-5", localSaved && "fill-current")} />
        </Button>
      </div>
      {/* Defer moderator role checks until the user actually opens a report.
          A feed page can mount dozens of PostCards at once. */}
      {showReport && (
        <ReportContentSheet
          open={showReport}
          onOpenChange={setShowReport}
          targetType="post"
          targetId={post.id}
        />
      )}
      {/* Edit Sheet */}
      {isOwner && (
        <EditPostSheet
          open={showEdit}
          onOpenChange={setShowEdit}
          post={post}
          onSave={async (updates) => {
            await updatePost(post.id, {
              ...updates,
              privacy: updates.privacy as 'everyone' | 'contacts' | 'close_friends' | 'only_me' | undefined,
            });
            toast({
              title: t('feed.postEdited', 'Publicação editada'),
              description: t('feed.postEditedDesc', 'A tua publicação foi atualizada'),
            });
          }}
        />
      )}
    </motion.article>
  );
});
