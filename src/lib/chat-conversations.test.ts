import { describe, expect, it } from 'vitest';
import { orderConversations } from './chat-conversations';

const conversation = (id: string, other: string, time: string, pinned = false) => ({
  id, type: 'direct', updated_at: time, is_pinned: pinned,
  participants: [{ user_id: 'me' }, { user_id: other }],
});

describe('Papos conversation order', () => {
  it('puts pinned conversations first, then sorts by the latest message', () => {
    const entries = [
      conversation('new', 'a', '2026-10-23T10:00:00Z'),
      conversation('pinned', 'b', '2026-10-20T10:00:00Z', true),
      { ...conversation('active', 'c', '2026-10-01T10:00:00Z'), last_message: { created_at: '2026-10-23T11:00:00Z' } },
    ];
    expect(orderConversations(entries, 'me').map(entry => entry.id)).toEqual(['pinned', 'active', 'new']);
    expect(entries[0].id).toBe('new');
  });

  it('keeps one direct conversation per person, preferring the pinned or newest one', () => {
    const entries = [
      conversation('old', 'a', '2026-10-01T10:00:00Z'),
      conversation('new', 'a', '2026-10-23T10:00:00Z'),
      conversation('pinned', 'b', '2026-10-01T10:00:00Z', true),
      conversation('duplicate', 'b', '2026-10-23T10:00:00Z'),
    ];
    expect(orderConversations(entries, 'me').map(entry => entry.id)).toEqual(['pinned', 'new']);
  });

  it('preserves separate groups with the same members', () => {
    const entries = ['one', 'two'].map(id => ({ ...conversation(id, 'a', '2026-10-23T10:00:00Z'), type: 'group' }));
    expect(orderConversations(entries, 'me')).toHaveLength(2);
  });
});
