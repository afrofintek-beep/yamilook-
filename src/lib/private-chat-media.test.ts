import { beforeEach, expect, it, vi } from 'vitest';
const { rpc, upload, createSignedUrl }=vi.hoisted(()=>({rpc:vi.fn(),upload:vi.fn(),createSignedUrl:vi.fn()}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc,storage:{from:(bucket:string)=>{expect(bucket).toBe('chat-attachments');return {upload,createSignedUrl};}}}}));
import { privateChatPath, uploadPrivateChatFile, signPrivateChatMedia } from './private-chat-media';
beforeEach(()=>{rpc.mockReset();upload.mockReset();createSignedUrl.mockReset();});
it('reserves a conversation-scoped path and stores a reference, not a bearer URL',async()=>{
 rpc.mockResolvedValue({data:{path:'conversation/user/id/file.pdf',reference:'chat-attachment://conversation/user/id/file.pdf'},error:null});upload.mockResolvedValue({error:null});
 const ref=await uploadPrivateChatFile('conversation',new Blob(['test']),'file.pdf','application/pdf');
 expect(ref).toBe('chat-attachment://conversation/user/id/file.pdf');
 expect(rpc).toHaveBeenCalledWith('reserve_chat_attachment',{p_conversation_id:'conversation',p_filename:'file.pdf'});
 expect(upload.mock.calls[0][2]).toMatchObject({cacheControl:'0',upsert:false});expect(createSignedUrl).not.toHaveBeenCalled();
});
it('does not upload when membership authorization fails',async()=>{
 rpc.mockResolvedValue({data:null,error:{message:'denied'}});await expect(uploadPrivateChatFile('outside',new Blob(['x']),'f','text/plain')).rejects.toThrow();expect(upload).not.toHaveBeenCalled();
});
it('signs for five minutes and propagates a denial',async()=>{
 createSignedUrl.mockResolvedValue({data:{signedUrl:'https://example.com/temporary'},error:null});expect(await signPrivateChatMedia('chat-attachment://c/u/id/f')).toBe('https://example.com/temporary');expect(createSignedUrl).toHaveBeenCalledWith('c/u/id/f',300);
 createSignedUrl.mockResolvedValue({data:null,error:{message:'denied'}});await expect(signPrivateChatMedia('chat-attachment://c/u/id/f')).rejects.toThrow('Sem acesso');
});
it('does not interpret remote URLs or traversal as private object paths',()=>{
 expect(privateChatPath('https://evil.example/chat-attachment://c/u/f')).toBeNull();expect(privateChatPath('chat-attachment://c/../f')).toBeNull();expect(privateChatPath('chat-attachment://c/u/f?token=x')).toBeNull();
});
