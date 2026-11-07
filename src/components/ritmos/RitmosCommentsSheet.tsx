import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MentionInput } from '@/components/feed/MentionInput';
import { MentionText } from '@/components/feed/MentionText';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Ritmo } from '@/hooks/useRitmos';
import { AfricanReactionType, AFRICAN_REACTIONS, getReactionIcon } from '@/lib/reactions';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLongPress } from '@/hooks/useLongPress';

interface Comment {
  id: string;
  ritmo_id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
  reaction_counts?: {
    sankofa: number;
    ubuntu: number;
    djembe: number;
    shango: number;
    eish: number;
  };
  my_reaction?: AfricanReactionType | null;
}

interface RitmosCommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ritmo: Ritmo | null;
}

export function RitmosCommentsSheet({ open, onOpenChange, ritmo }: RitmosCommentsSheetProps) {
  useUiLocale();
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch comments
  const fetchComments = useCallback(async () => {
    if (!ritmo) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ritmos_comments')
        .select(`
          *,
          profiles:user_id (id, display_name, username, avatar_url)
        `)
        .eq('ritmo_id', ritmo.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Enrich with reaction counts
      const enrichedComments = await Promise.all(
        (data || []).map(async (comment) => {
          // Get reaction counts
          const { data: reactions } = await supabase
            .from('ritmos_comment_reactions')
            .select('reaction_type')
            .eq('comment_id', comment.id);

          const counts = {
            sankofa: 0,
            ubuntu: 0,
            djembe: 0,
            shango: 0,
            eish: 0,
          };

          reactions?.forEach((r) => {
            const type = r.reaction_type as AfricanReactionType;
            if (type in counts) {
              counts[type]++;
            }
          });

          // Get user's reaction
          let myReaction: AfricanReactionType | null = null;
          if (user) {
            const userReaction = reactions?.find(
              (r) => r.reaction_type
            );
            // We need to check if user has reacted
            const { data: userReactionData } = await supabase
              .from('ritmos_comment_reactions')
              .select('reaction_type')
              .eq('comment_id', comment.id)
              .eq('user_id', user.id)
              .maybeSingle();
            myReaction = userReactionData?.reaction_type as AfricanReactionType || null;
          }

          return {
            ...comment,
            user: comment.profiles,
            reaction_counts: counts,
            my_reaction: myReaction,
          };
        })
      );

      setComments(enrichedComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [ritmo, user]);

  // Fetch when sheet opens
  useEffect(() => {
    if (open && ritmo) {
      fetchComments();
    }
  }, [open, ritmo, fetchComments]);

  // Submit comment
  const handleSubmit = async () => {
    if (!user || !ritmo || !newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('ritmos_comments')
        .insert({
          ritmo_id: ritmo.id,
          user_id: user.id,
          content: newComment.trim(),
        })
        .select(`
          *,
          profiles:user_id (id, display_name, username, avatar_url)
        `)
        .single();

      if (error) throw error;

      setComments(prev => [...prev, {
        ...data,
        user: data.profiles,
        reaction_counts: { sankofa: 0, ubuntu: 0, djembe: 0, shango: 0, eish: 0 },
        my_reaction: null,
      }]);
      setNewComment('');
    } catch (error) {
      console.error('Error posting comment:', error);
      toast.error(uiText("Failed to post comment"));
    } finally {
      setSubmitting(false);
    }
  };

  // React to comment
  const handleReactToComment = async (commentId: string, type: AfricanReactionType) => {
    if (!user) {
      toast.error(uiText("Please sign in to react"));
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('ritmos_comment_reactions')
        .select('id, reaction_type')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        if (existing.reaction_type === type) {
          await supabase
            .from('ritmos_comment_reactions')
            .delete()
            .eq('id', existing.id);
        } else {
          await supabase
            .from('ritmos_comment_reactions')
            .update({ reaction_type: type })
            .eq('id', existing.id);
        }
      } else {
        await supabase
          .from('ritmos_comment_reactions')
          .insert({
            comment_id: commentId,
            user_id: user.id,
            reaction_type: type,
          });
      }

      // Refresh comments
      fetchComments();
    } catch (error) {
      console.error('Error reacting to comment:', error);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl p-0">
        <SheetHeader className="px-4 py-3 border-b border-border">
          <SheetTitle className="text-center">
            {comments.length}{uiText(" Comments")}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(70vh-8rem)]">
          <div className="p-4 space-y-4">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">{uiText("No comments yet")}</p>
                <p className="text-sm text-muted-foreground/60">{uiText("Be the first to comment!")}</p>
              </div>
            ) : (
              <AnimatePresence>
                {comments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onNavigate={() => onOpenChange(false)}
                    onReact={(type) => handleReactToComment(comment.id, type)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-bottom">
          <div className="flex items-center gap-2">
            <MentionInput
              placeholder={uiText("Add a comment...")}
              value={newComment}
              onValueChange={setNewComment}
              onSubmit={handleSubmit}
              disabled={!user || submitting}
              className="flex-1 rounded-full"
            />
            <Button
              size="icon"
              className="rounded-full"
              onClick={handleSubmit}
              disabled={!user || !newComment.trim() || submitting}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Comment item component
function CommentItem({
  comment,
  onReact,
  onNavigate
}: {
  comment: Comment;
  onNavigate: () => void;
  onReact: (type: AfricanReactionType) => void;
}) {
  useUiLocale();
  const [showPicker, setShowPicker] = useState(false);

  const { handlers: longPressHandlers } = useLongPress({
    onLongPress: () => {
      setShowPicker(true);
      if (navigator.vibrate) navigator.vibrate(50);
    },
    delay: 400,
  });

  const totalReactions = comment.reaction_counts
    ? Object.values(comment.reaction_counts).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 relative"
      {...longPressHandlers}
    >
      <Avatar className="w-10 h-10">
        <AvatarImage src={comment.user?.avatar_url || ''} />
        <AvatarFallback>
          {comment.user?.display_name?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">
            {comment.user?.username || comment.user?.display_name || uiText("User")}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm text-foreground"><MentionText text={comment.content} onNavigate={onNavigate} /></p>

        {/* Reactions display */}
        {totalReactions > 0 && (
          <div className="flex items-center gap-1 mt-1">
            {Object.entries(comment.reaction_counts || {})
              .filter(([_, count]) => count > 0)
              .map(([type, count]) => (
                <span key={type} className="text-xs flex items-center gap-0.5">
                  {getReactionIcon(type)} {count}
                </span>
              ))}
          </div>
        )}

        {/* My reaction indicator */}
        {comment.my_reaction && (
          <div className="absolute right-0 top-0">
            <span className="text-lg">{getReactionIcon(comment.my_reaction)}</span>
          </div>
        )}
      </div>

      {/* Reaction picker */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute left-12 top-0 z-50 bg-card/95 backdrop-blur-md rounded-2xl shadow-xl border border-border p-1.5 flex gap-0.5"
            >
              {AFRICAN_REACTIONS.map((reaction) => (
                <button
                  key={reaction.type}
                  onClick={() => {
                    onReact(reaction.type);
                    setShowPicker(false);
                  }}
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center text-xl transition-all hover:bg-muted hover:scale-110",
                    comment.my_reaction === reaction.type && "bg-primary/20"
                  )}
                >
                  {reaction.icon}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
