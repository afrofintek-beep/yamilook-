import { supabase } from '@/integrations/supabase/client';
import { createEmptyReactionCounts } from '@/lib/reactions';
import type { PostWithUser } from '@/hooks/usePosts';

export async function loadNotificationPost(postId: string): Promise<PostWithUser | null> {
  // Always recheck the recipient's current access; never trust notification data.
  const { data: post, error } = await supabase.from('posts').select('*')
    .eq('id', postId).eq('is_hidden', false).maybeSingle();
  if (error) throw error;
  if (!post) return null;
  const { data: author } = await supabase.from('public_profiles')
    .select('id,display_name,username,avatar_url').eq('id', post.user_id).maybeSingle();
  return {
    ...post, type: post.type as PostWithUser['type'], privacy: post.privacy as PostWithUser['privacy'],
    user: { id: post.user_id, display_name: author?.display_name || 'Utilizador',
      username: author?.username || '', avatar_url: author?.avatar_url || null },
    is_liked: false, my_reaction: null, is_saved: false,
    reaction_counts: createEmptyReactionCounts(), topics: [],
  };
}
