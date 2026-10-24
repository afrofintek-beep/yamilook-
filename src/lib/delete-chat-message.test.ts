import { beforeEach, expect, it, vi } from 'vitest';
import { deleteChatMessage } from './delete-chat-message';
const { single, update, eq } = vi.hoisted(() => ({ single:vi.fn(), update:vi.fn(), eq:vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({supabase:{from:()=>({update})}}));
beforeEach(() => {
  vi.resetAllMocks();
  const query = {eq, select:()=>({single})};
  update.mockReturnValue(query); eq.mockReturnValue(query);
});
it('requires the server to confirm the requested message was deleted', async () => {
  single.mockResolvedValue({data:{id:'message',is_deleted:true},error:null});
  expect(await deleteChatMessage('message','sender')).toEqual({error:null});
  expect(eq).toHaveBeenCalledWith('sender_id','sender');
});
it.each([null,{id:'other',is_deleted:true},{id:'message',is_deleted:false}])('rejects an unconfirmed update: %s',async data=>{
  single.mockResolvedValue({data,error:null});
  expect((await deleteChatMessage('message','sender')).error).toBeInstanceOf(Error);
});
it('reports permission and network errors',async()=>{
  single.mockResolvedValueOnce({data:null,error:{message:'Permission denied'}});
  expect((await deleteChatMessage('message','sender')).error?.message).toBe('Permission denied');
  single.mockRejectedValueOnce(new Error('offline'));
  expect((await deleteChatMessage('message','sender')).error?.message).toContain('ligar');
});
