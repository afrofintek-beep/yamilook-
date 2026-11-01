import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { MoreHorizontal, Trash2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePosts, Comment, PostWithUser } from '@/hooks/usePosts';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { CommentReactions } from './CommentReactions';

interface CommentsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: PostWithUser | null;
}

export function CommentsSheet({ open, onOpenChange, post }: CommentsSheetProps) {
  const { user } = useAuth();
  const { getComments, addComment, deleteComment, toggleCommentReaction } = usePosts({ autoLoad: false });
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Count total comments including replies
  const totalComments = comments.reduce((acc, comment) => {
    return acc + 1 + (comment.replies?.length || 0);
  }, 0);

  useEffect(() => {
    if (open && post) {
      setLoading(true);
      getComments(post.id).then(data => {
        setComments(data);
        setLoading(false);
      });
    }
  }, [open, post?.id, getComments]);

  const handleSubmit = () => {
    if (!newComment.trim() || !post || !user) return;

    const commentContent = newComment.trim();
    const parentId = replyingTo?.id;

    // Create optimistic comment
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}`,
      post_id: post.id,
      user_id: user.id,
      content: commentContent,
      parent_comment_id: parentId || null,
      likes_count: 0,
      created_at: new Date().toISOString(),
      user: {
        id: user.id,
        display_name: user.email?.split('@')[0] || 'You',
        avatar_url: null,
        username: user.email?.split('@')[0] || '',
      },
      replies: [],
      reactions: {},
      my_reaction: null,
    };

    // Add comment optimistically
    if (parentId) {
      // Add as reply to parent comment
      setComments(prev => prev.map(c => 
        c.id === parentId 
          ? { ...c, replies: [...(c.replies || []), optimisticComment] }
          : c
      ));
    } else {
      // Add as top-level comment
      setComments(prev => [...prev, optimisticComment]);
    }

    // Clear input immediately
    setNewComment('');
    setReplyingTo(null);

    // Fire and forget - sync with server in background
    addComment(post.id, commentContent, parentId).then(realComment => {
      if (realComment) {
        // Replace temp comment with real one
        if (parentId) {
          setComments(prev => prev.map(c => 
            c.id === parentId 
              ? { 
                  ...c, 
                  replies: c.replies?.map(r => 
                    r.id === optimisticComment.id 
                      ? { ...optimisticComment, id: realComment.id }
                      : r
                  ) || []
                }
              : c
          ));
        } else {
          setComments(prev => prev.map(c => 
            c.id === optimisticComment.id 
              ? { ...optimisticComment, id: realComment.id }
              : c
          ));
        }
      }
    });
  };

  const handleDelete = (commentId: string) => {
    if (!post) return;
    
    // Optimistically remove the comment
    setComments(prev => {
      // Check if it's a top-level comment
      const isTopLevel = prev.some(c => c.id === commentId);
      
      if (isTopLevel) {
        return prev.filter(c => c.id !== commentId);
      }
      
      // It's a reply - remove from parent
      return prev.map(c => ({
        ...c,
        replies: c.replies?.filter(r => r.id !== commentId) || []
      }));
    });
    
    // Fire and forget
    deleteComment(commentId, post.id);
  };

  const handleReact = async (commentId: string, reactionType: string) => {
    if (!user) return;

    // Find the comment (could be top-level or reply)
    const findComment = (comments: Comment[]): Comment | null => {
      for (const c of comments) {
        if (c.id === commentId) return c;
        if (c.replies) {
          const found = findComment(c.replies);
          if (found) return found;
        }
      }
      return null;
    };

    const comment = findComment(comments);
    if (!comment) return;

    const previousReaction = comment.my_reaction;

    // Optimistic update
    const updateReactions = (c: Comment): Comment => {
      if (c.id !== commentId) {
        return { ...c, replies: c.replies?.map(updateReactions) };
      }

      const newReactions = { ...c.reactions };
      
      if (previousReaction === reactionType) {
        // Remove reaction
        newReactions[reactionType] = Math.max(0, (newReactions[reactionType] || 1) - 1);
        if (newReactions[reactionType] === 0) delete newReactions[reactionType];
        return { ...c, reactions: newReactions, my_reaction: null };
      } else {
        // Add or change reaction
        if (previousReaction) {
          newReactions[previousReaction] = Math.max(0, (newReactions[previousReaction] || 1) - 1);
          if (newReactions[previousReaction] === 0) delete newReactions[previousReaction];
        }
        newReactions[reactionType] = (newReactions[reactionType] || 0) + 1;
        return { ...c, reactions: newReactions, my_reaction: reactionType };
      }
    };

    setComments(prev => prev.map(updateReactions));

    // Fire and forget
    toggleCommentReaction(commentId, reactionType);
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <motion.div
      key={comment.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isReply && "ml-12")}
    >
      <Link
        to={`/profile/${comment.user_id}`}
        onClick={() => onOpenChange(false)}
        aria-label={comment.user.display_name || comment.user.username}
        className="flex-shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
      <Avatar className={cn("flex-shrink-0", isReply ? "w-8 h-8" : "w-10 h-10")}>
        <AvatarImage src={comment.user.avatar_url || ''} />
        <AvatarFallback className="bg-gradient-primary text-white text-xs">
          {comment.user.display_name?.[0]?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="bg-secondary/50 rounded-2xl px-4 py-2">
          <Link
            to={`/profile/${comment.user_id}`}
            onClick={() => onOpenChange(false)}
            className="block w-fit font-semibold text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >{comment.user.display_name || comment.user.username}</Link>
          <p className="text-sm">{comment.content}</p>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
          
          {/* African-inspired reactions */}
          <CommentReactions
            commentId={comment.id}
            reactions={comment.reactions}
            myReaction={comment.my_reaction}
            onReact={handleReact}
          />
          
          <button 
            className="hover:text-foreground"
            onClick={() => setReplyingTo(comment)}
          >
            Reply
          </button>
          {comment.user_id === user?.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  onClick={() => handleDelete(comment.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3">
            {comment.replies.map(reply => renderComment(reply, true))}
          </div>
        )}
      </div>
    </motion.div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] rounded-t-3xl p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Comments {totalComments > 0 && `(${totalComments})`}</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(80vh-140px)]">
          <div className="p-4 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-16 rounded-2xl bg-secondary animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No comments yet</p>
                <p className="text-sm text-muted-foreground mt-1">Be the first to comment!</p>
              </div>
            ) : (
              <AnimatePresence>
                {comments.map(comment => renderComment(comment))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background safe-bottom">
          {replyingTo && (
            <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
              <span>Replying to {replyingTo.user.display_name}</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setReplyingTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-gradient-primary text-white text-xs">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Write a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                className="flex-1 rounded-full bg-secondary/50 border-none"
              />
              <Button 
                size="icon"
                className="rounded-full bg-gradient-primary text-white"
                disabled={!newComment.trim() || isSubmitting}
                onClick={handleSubmit}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
