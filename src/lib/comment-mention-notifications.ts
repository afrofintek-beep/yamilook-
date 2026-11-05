import { supabase } from '@/integrations/supabase/client';
import { mentionedHandles } from './comment-mentions';

export async function fetchCommentMentions(userId: string, since: string) {
  const { data: ownProfile, error: profileError } = await supabase.from('public_profiles')
    .select('username').eq('id', userId).maybeSingle();
  if (profileError || !ownProfile?.username) return [];
  const handle = ownProfile.username;
  const pattern = '%@' + handle.replace(/[_%\\]/g, '\\$&') + '%';
  // The inner join independently applies parent-post RLS. Comment RLS also
  // enforces parent visibility, moderation and blocks for direct API readers.
  const { data, error } = await supabase.from('post_comments')
    .select('id,content,created_at,post_id,user_id,posts!inner(id,is_hidden)')
    .eq('is_hidden', false).eq('posts.is_hidden', false)
    .ilike('content', pattern).neq('user_id', userId)
    .gte('created_at', since).order('created_at', { ascending: false }).limit(50);
  if (error) return [];
  const mentions = (data || []).filter(comment => mentionedHandles(comment.content).includes(handle.toLowerCase()));
  if (!mentions.length) return [];
  const { data: profiles } = await supabase.from('public_profiles')
    .select('id,display_name,username,avatar_url').in('id', [...new Set(mentions.map(c => c.user_id))]);
  const senders = new Map((profiles || []).map(profile => [profile.id, profile]));
  return mentions.map(comment => {
    const sender = senders.get(comment.user_id);
    return {
      id: `mention_${comment.id}`, type: 'mention' as const,
      title: sender?.display_name || sender?.username || 'Utilizador',
      message: 'mencionou-te num comentário', avatar_url: sender?.avatar_url,
      created_at: comment.created_at, read: false,
      action_data: { post_id: comment.post_id, sender_id: comment.user_id },
    };
  });
}
