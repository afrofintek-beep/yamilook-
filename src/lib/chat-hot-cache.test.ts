import { beforeEach, describe, expect, it } from 'vitest';
import { clearChatHotCache, readChatHotCache, saveChatHotCache } from './chat-hot-cache';

const msg = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, conversation_id: 'chat-a', message_type: 'text',
  content: id, created_at: '2026-11-02T10:00:00Z',
  media_url: null, is_deleted: false, expires_at: null, is_view_once: false,
  ...overrides,
});
beforeEach(() => clearChatHotCache());

describe('KOSOLOLA hot conversation snapshots', () => {
  it('restores ordinary text for the same account without writing to browser storage', () => {
    saveChatHotCache('user-a', 'chat-a', [msg('Olá')]);
    expect(readChatHotCache('user-a', 'chat-a').map(row => row.content)).toEqual(['Olá']);
    expect(readChatHotCache('user-b', 'chat-a')).toEqual([]);
    expect(readChatHotCache('user-a', 'chat-b')).toEqual([]);
  });

  it('excludes expiring, one-time, deleted messages and attachments', () => {
    saveChatHotCache('user-a', 'chat-a', [
      msg('safe'), msg('expired', { expires_at: '2026-11-02T12:00:00Z' }),
      msg('one-time', { is_view_once: true }),
      msg('deleted', { is_deleted: true }),
      msg('image', { message_type: 'image', media_url: 'private://image' }),
      msg('wrong', { conversation_id: 'chat-b' }),
    ]);
    expect(readChatHotCache('user-a', 'chat-a').map(row => row.id)).toEqual(['safe']);
  });

  it('caps snapshots and purges them on logout', () => {
    saveChatHotCache('user-a', 'chat-a', Array.from({ length: 100 }, (_, n) => msg(String(n))));
    expect(readChatHotCache('user-a', 'chat-a')).toHaveLength(60);
    clearChatHotCache();
    expect(readChatHotCache('user-a', 'chat-a')).toEqual([]);
  });
});
