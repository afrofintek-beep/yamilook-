import {afterEach,expect,it,vi} from 'vitest';
import {shareCard} from './export';
afterEach(()=>vi.unstubAllGlobals());
it('shares the ready image in the original user action',async()=>{const share=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{share,canShare:()=>true});const blob=new Blob(['image'],{type:'image/png'});const result=shareCard(blob,'Selected details');expect(share).toHaveBeenCalledOnce();expect(share.mock.calls[0][0].files[0].name).toBe('AFROLOC-cartao.png');expect(await result).toBe('shared')});
it('cancelling native sharing does not download or copy private details',async()=>{vi.stubGlobal('navigator',{share:vi.fn().mockRejectedValue(new DOMException('Cancelled','AbortError')),canShare:()=>true});expect(await shareCard(new Blob(),'details')).toBe('cancelled')});
it('falls back to the selected text when file sharing is unavailable',async()=>{const share=vi.fn().mockResolvedValue(undefined);vi.stubGlobal('navigator',{share,canShare:()=>false});await shareCard(new Blob(),'selected details');expect(share).toHaveBeenCalledWith({title:'AFROLOC',text:'selected details'})});
