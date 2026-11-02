/**
 * A strictly in-memory, account-scoped hot cache for returning to conversations.
 * No private message is written to localStorage, IndexedDB, or the service worker.
 * It only retains ordinary, non-expiring text. Server membership must still be
 * revalidated on every open; it is never used as proof of access.
 */
const MAX_CONVERSATIONS = 8;
const MAX_MESSAGES = 60;
const MAX_AGE_MS = 5 * 60 * 1000;

export interface CachedChatMessage {
  id: string;
  conversation_id: string;
  message_type: string;
  content: string | null;
  created_at: string;
  expires_at?: string | null;
  is_view_once?: boolean | null;
  is_deleted?: boolean | null;
  media_url?: string | null;
  thumbnail_url?: string | null;
  [key: string]: unknown;
}

const snapshots = new Map<string, { expiresAt: number; rows: CachedChatMessage[] }>();
const keyFor = (userId: string, conversationId: string) => `${userId}:${conversationId}`;

export function readChatHotCache<T extends CachedChatMessage>(userId: string, conversationId: string): T[] {
  const key = keyFor(userId, conversationId);
  const entry = snapshots.get(key);
  if (!entry) return [];
  if (entry.expiresAt <= Date.now()) {
    snapshots.delete(key);
    return [];
  }
  snapshots.delete(key);
  snapshots.set(key, entry);
  return entry.rows.map(row => ({ ...row })) as T[];
}

export function saveChatHotCache<T extends CachedChatMessage>(userId: string, conversationId: string, rows: T[]) {
  if (!userId || !conversationId) return;
  const visible = rows
    .filter(row => row.conversation_id === conversationId && row.message_type === 'text' &&
      !row.expires_at && !row.is_view_once && !row.is_deleted && typeof row.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(row => ({ ...row, media_url: null, thumbnail_url: null }));
  const key = keyFor(userId, conversationId);
  snapshots.delete(key);
  snapshots.set(key, { expiresAt: Date.now() + MAX_AGE_MS, rows: visible });
  while (snapshots.size > MAX_CONVERSATIONS) snapshots.delete(snapshots.keys().next().value!);
}

export function clearChatHotCache(userId?: string, conversationId?: string) {
  if (!userId) { snapshots.clear(); return; }
  if (conversationId) { snapshots.delete(keyFor(userId, conversationId)); return; }
  for (const key of snapshots.keys()) if (key.startsWith(`${userId}:`)) snapshots.delete(key);
}
