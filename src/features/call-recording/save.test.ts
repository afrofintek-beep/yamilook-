import { beforeEach, expect, it, vi } from 'vitest';
import { saveRecording } from './save';
import type { RecordingSession } from './api';
import type { PendingRecording } from './pending';
const mocks=vi.hoisted(()=>({api:vi.fn(),upload:vi.fn(),keep:vi.fn(),remove:vi.fn(),session:vi.fn()}));
vi.mock('./api',()=>({recordingSession:mocks.api}));
vi.mock('./pending',()=>({keepRecording:mocks.keep,removePendingRecording:mocks.remove}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{auth:{getSession:mocks.session},storage:{from:()=>({upload:mocks.upload})}}}));
const file:PendingRecording={id:'recording',callId:'call',ownerId:'owner',blob:new Blob(['sound'],{type:'audio/webm'}),duration:3,createdAt:1};
let state:RecordingSession;
beforeEach(()=>{
 vi.clearAllMocks();state={id:'recording',initiated_by:'owner',status:'processing',deadline:'',consents:[{user_id:'other',consented:true,revoked_at:null}]};
 mocks.session.mockResolvedValue({data:{session:{user:{id:'owner'}}}});mocks.keep.mockResolvedValue(true);mocks.remove.mockResolvedValue(undefined);mocks.upload.mockResolvedValue({error:null});
 mocks.api.mockImplementation(async (_call,action)=>{if(action==='complete')state={...state,status:'completed'};return state;});
});
it('persists the Blob before sending and deletes recovery only after acknowledged completion',async()=>{
 await saveRecording(file);expect(mocks.keep.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0]);
 expect(mocks.api).toHaveBeenCalledWith('call','state','recording');expect(mocks.remove).toHaveBeenCalledWith(file);
});
it('retains media after upload or completion failure and never labels it saved',async()=>{
 mocks.upload.mockResolvedValue({error:{statusCode:'500'}});await expect(saveRecording(file)).rejects.toThrow('enviar');expect(mocks.remove).not.toHaveBeenCalled();
 mocks.upload.mockResolvedValue({error:null});mocks.api.mockImplementation(async(_c,a)=>{if(a==='complete')throw Error();return state;});
 await expect(saveRecording(file)).rejects.toThrow('confirmar');expect(mocks.remove).not.toHaveBeenCalled();
});
it('deduplicates concurrent retries for the same recording',async()=>{
 const a=saveRecording(file),b=saveRecording(file);expect(a).toBe(b);await a;expect(mocks.upload).toHaveBeenCalledOnce();
});
it('recovers a lost upload response without overwriting its immutable object',async()=>{
 mocks.upload.mockResolvedValue({error:{statusCode:'409'}});await saveRecording(file);
 expect(mocks.api).toHaveBeenCalledWith('call','complete','recording',undefined,expect.objectContaining({file_size_bytes:5}));
});
it('does not upload again when a completion response was lost',async()=>{
 state.status='completed';await saveRecording(file);expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.remove).toHaveBeenCalled();
});
it('refuses another account and keeps recovery scoped to its original owner',async()=>{
 mocks.session.mockResolvedValue({data:{session:{user:{id:'other'}}}});await expect(saveRecording(file)).rejects.toThrow();expect(mocks.api).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();
});
it('refuses stopped requests and never uploads after consent is refused',async()=>{
 state.status='stopped';await expect(saveRecording(file)).rejects.toThrow();expect(mocks.upload).not.toHaveBeenCalled();
 state.consents=[{user_id:'other',consented:false,revoked_at:'now'}];await expect(saveRecording(file)).rejects.toThrow();expect(mocks.remove).toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();
});
it('bounds a stalled upload and keeps the recoverable Blob',async()=>{
 vi.useFakeTimers();
 try {
  state.id='timeout';mocks.upload.mockImplementation(()=>new Promise(()=>{}));
  const result=expect(saveRecording({...file,id:'timeout'})).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(120001);await result;
  expect(mocks.remove).not.toHaveBeenCalled();
 } finally {vi.useRealTimers();}
});
