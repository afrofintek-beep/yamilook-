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
      return { error: new Error('A eliminação não foi confirmada. Atualiza a conversa e tenta novamente.') };
    }
    return { error: null };
  } catch {
    return { error: new Error('Não foi possível ligar para apagar a mensagem. Tenta novamente.') };
  }
}
