import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

interface ConversationSummary {
  id: string;
  type: string;
  updated_at: string;
  is_pinned?: boolean | null;
  participants?: { user_id: string }[];
  last_message?: { created_at: string };
}

export function orderConversations<T extends ConversationSummary>(conversations: T[], userId: string): T[] {
  const sorted = [...conversations].sort((a, b) =>
    Number(!!b.is_pinned) - Number(!!a.is_pinned) ||
    new Date(b.last_message?.created_at || b.updated_at).getTime() - new Date(a.last_message?.created_at || a.updated_at).getTime());
  const seen = new Set<string>();
  return sorted.filter(conversation => {
    if (conversation.type !== 'direct') return true;
    const other = conversation.participants?.find(participant => participant.user_id !== userId);
    if (!other) return true;
    if (seen.has(other.user_id)) return false;
    seen.add(other.user_id);
    return true;
  });
}


type Conversation = Database['public']['Tables']['conversations']['Row'];

/** The server creates the conversation and memberships in one transaction. */
export async function createChatConversation(participants: string[], name?: string, avatar?: string | null): Promise<{ data: Conversation | null; error: Error | null }> {
  const { data, error } = await supabase.rpc('create_chat_conversation', {
    p_participant_ids: participants, p_group_name: name || null, p_avatar_url: avatar || null,
  });
  if (error) return { data: null, error: new Error(error.message) };
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.id !== 'string') {
    return { data: null, error: new Error('Resposta inválida ao criar conversa') };
  }
  return { data: data as unknown as Conversation, error: null };
}
