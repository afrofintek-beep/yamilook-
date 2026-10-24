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

import { beforeEach, vi } from 'vitest';
const { rpc } = vi.hoisted(()=>({rpc:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
import { createChatConversation } from './chat-conversations';
beforeEach(()=>rpc.mockReset());
it('uses the atomic server operation for every creation',async()=>{
 rpc.mockResolvedValue({data:{id:'chat',type:'group'},error:null});
 expect((await createChatConversation(['B'],'Group')).data?.id).toBe('chat');
 expect(rpc).toHaveBeenCalledWith('create_chat_conversation',{p_participant_ids:['B'],p_group_name:'Group',p_avatar_url:null});
});
it('returns a server failure without a local fallback that bypasses authorization',async()=>{
 rpc.mockResolvedValue({data:null,error:{message:'Participant unavailable'}});
 expect((await createChatConversation(['B'])).error?.message).toBe('Participant unavailable');
 expect(rpc).toHaveBeenCalledOnce();
});
it('does not navigate with an invalid server response',async()=>{
 rpc.mockResolvedValue({data:{},error:null});
 expect((await createChatConversation(['B'])).data).toBeNull();
});
