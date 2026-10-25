import {describe,it,expect,vi,beforeEach} from 'vitest';
const rpc=vi.hoisted(()=>vi.fn());
vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
import {scheduledAction,inviteUrl,copyInvitation,shareInvitation} from './api';
describe('scheduled call service',()=>{
 beforeEach(()=>rpc.mockReset());
 it('does not turn database errors into success',async()=>{rpc.mockResolvedValue({data:null,error:{message:'contact_required'}});await expect(scheduledAction('create')).rejects.toThrow('contactos');});
 it('requires server confirmation',async()=>{rpc.mockResolvedValue({data:null,error:null});await expect(scheduledAction('cancel','id')).rejects.toThrow('confirmou');});
 it('passes revision and action to the atomic endpoint',async()=>{rpc.mockResolvedValue({data:{id:'a'},error:null});expect(await scheduledAction('edit','a',{revision:3})).toEqual({id:'a'});expect(rpc).toHaveBeenCalledWith('scheduled_call_action',{p_action:'edit',p_id:'a',p_payload:{revision:3}});});
 it('preserves standalone route and uses a call route, not a group invitation',()=>{expect(inviteUrl('a','https://kosolola.com','/papos-app/calls')).toBe('https://kosolola.com/papos-app/scheduled-call/a');expect(inviteUrl('a','https://www.yamilook.com','/calls')).toBe('https://www.yamilook.com/scheduled-call/a');});
 it('reports clipboard failures',async()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:vi.fn().mockRejectedValue(new Error('denied'))}});await expect(copyInvitation('a')).rejects.toThrow('denied');});
 it('uses native sharing when available',async()=>{const share=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,'share',{configurable:true,value:share});await shareInvitation({id:'a',title:'Call'} as any);expect(share).toHaveBeenCalledWith(expect.objectContaining({title:'Call',url:expect.stringContaining('/scheduled-call/a')}));});
});
