import { beforeEach, expect, it, vi } from 'vitest';
import { deleteChatMessage, deleteChatMessageForMe } from './delete-chat-message';
const { single, update, upsert, eq } = vi.hoisted(() => ({ single:vi.fn(), update:vi.fn(), upsert:vi.fn(), eq:vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({supabase:{from:()=>({update,upsert})}}));
beforeEach(() => {
  vi.resetAllMocks();
  const query = {eq, select:()=>({single})};
  upsert.mockReturnValue(query); update.mockReturnValue(query); eq.mockReturnValue(query);
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

it('persists only personal removal and confirms the returned owner', async () => {
  single.mockResolvedValue({data:{message_id:'message',user_id:'me',is_hidden:true},error:null});
  expect(await deleteChatMessageForMe('message','me')).toEqual({error:null});
  expect(upsert).toHaveBeenCalledWith({message_id:'message',user_id:'me',is_hidden:true}, {onConflict:'user_id,message_id'});
  expect(update).not.toHaveBeenCalled();
});
it.each([null,{message_id:'message',user_id:'other',is_hidden:true},{message_id:'message',user_id:'me',is_hidden:false}])('rejects unconfirmed personal removal: %s', async data => {
  single.mockResolvedValue({data,error:null});
  expect((await deleteChatMessageForMe('message','me')).error).toBeInstanceOf(Error);
});
