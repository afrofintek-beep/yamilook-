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
