import { beforeEach, expect, it, vi } from 'vitest';
import { sendSharedPost } from './send-shared-post';
const { insert, maybeSingle } = vi.hoisted(() => ({ insert: vi.fn(), maybeSingle: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert, select: () => ({ eq: () => ({ maybeSingle }) }) }) } }));
const request = { id:'stable-message',postId:'be23e228-a441-44ea-a14c-5368fd8097a7',conversationId:'chosen-group',userId:'me' };
beforeEach(() => vi.resetAllMocks());
it('sends only the canonical link using the current identity and chosen conversation', async () => {
  insert.mockResolvedValue({error:null}); await sendSharedPost(request);
  expect(insert).toHaveBeenCalledWith({id:request.id,sender_id:'me',conversation_id:'chosen-group',message_type:'text',content:`https://www.yamilook.com/post/${request.postId}`});
});
it('reconciles an accepted send after a timeout without producing a second message ID', async () => {
  insert.mockResolvedValue({error:{message:'duplicate'}});
  maybeSingle.mockResolvedValue({data:{id:request.id,sender_id:'me',conversation_id:'chosen-group',content:`https://www.yamilook.com/post/${request.postId}`}});
  await expect(sendSharedPost(request)).resolves.toBeUndefined();
});
it('does not report a rejected or mismatched send as successful', async () => {
  insert.mockResolvedValue({error:{message:'RLS'}}); maybeSingle.mockResolvedValue({data:null});
  await expect(sendSharedPost(request)).rejects.toThrow('Não foi possível enviar');
  maybeSingle.mockResolvedValue({data:{sender_id:'another',conversation_id:'chosen-group',content:`https://www.yamilook.com/post/${request.postId}`}});
  await expect(sendSharedPost(request)).rejects.toThrow();
});
