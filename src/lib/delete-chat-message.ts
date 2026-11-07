import { uiText } from '@/i18n/ui-copy';
import { supabase } from '@/integrations/supabase/client';

/** A successful HTTP request can still update zero rows under RLS. */
export async function deleteChatMessage(messageId: string, senderId: string) {
  try {
    const { data, error } = await supabase.from('messages')
      .update({ is_deleted: true, content: null })
      .eq('id', messageId).eq('sender_id', senderId)
      .select('id, is_deleted').single();
    if (error) return { error: new Error(error.message) };
    if (!data || data.id !== messageId || !data.is_deleted) {
      return { error: new Error(uiText("A eliminação não foi confirmada. Atualiza a conversa e tenta novamente.")) };
    }
    return { error: null };
  } catch {
    return { error: new Error(uiText("Não foi possível ligar para apagar a mensagem. Tenta novamente.")) };
  }
}

/** Persist a personal removal; the visible_messages view excludes this row only for its owner. */
export async function deleteChatMessageForMe(messageId: string, userId: string) {
  try {
    const { data, error } = await supabase.from('hidden_messages')
      .upsert({ message_id: messageId, user_id: userId, is_hidden: true }, { onConflict: 'user_id,message_id' })
      .select('message_id, user_id, is_hidden').single();
    if (error) return { error: new Error(error.message) };
    if (!data || data.message_id !== messageId || data.user_id !== userId || !data.is_hidden) {
      return { error: new Error(uiText("A eliminação não foi confirmada. Tenta novamente.")) };
    }
    return { error: null };
  } catch {
    return { error: new Error(uiText("Não foi possível ligar para apagar a mensagem. Tenta novamente.")) };
  }
}
