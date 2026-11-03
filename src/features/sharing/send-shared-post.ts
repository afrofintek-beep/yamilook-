import { supabase } from '@/integrations/supabase/client';
import { postUrl } from '../../../shared/public-post.mjs';

/** Reuse one ID across retries, including when the server accepted a timed-out send. */
export async function sendSharedPost({ id, postId, conversationId, userId }: { id: string; postId: string; conversationId: string; userId: string }) {
  const content = postUrl(postId);
  const { error } = await supabase.from('messages').insert({ id, sender_id: userId, conversation_id: conversationId, message_type: 'text', content });
  if (!error) return;
  const { data: existing } = await supabase.from('messages').select('id,sender_id,conversation_id,content').eq('id', id).maybeSingle();
  if (existing?.sender_id === userId && existing.conversation_id === conversationId && existing.content === content) return;
  throw new Error('Não foi possível enviar. Tenta novamente.');
}
