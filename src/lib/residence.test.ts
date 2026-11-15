import {expect,it,vi,beforeEach,afterEach} from 'vitest';
import {changeAppLanguage} from '@/i18n';
import {uiText} from '@/i18n/ui-copy';
const rpc=vi.hoisted(()=>vi.fn());vi.mock('@/integrations/supabase/client',()=>({supabase:{rpc}}));
import {submitResidence,validResidencePlan} from './residence';
beforeEach(()=>rpc.mockReset().mockResolvedValue({data:{status:'pending'},error:null}));
afterEach(async()=>{await changeAppLanguage('pt');});
it('does not submit a travelling user GPS as a home coordinate',async()=>{await submitResidence({method:'away',lat:1,lng:2,accuracy:5},'AO','Luanda','Talatona');expect(rpc.mock.calls[0][1]).toMatchObject({p_method:'away',p_lat:null,p_lng:null,p_accuracy:null,p_code:null});});
it('never lets the client request verified status',async()=>{await submitResidence({method:'existing',code:'ao-lda-tal-g10-abc-def'},'AO','Luanda','Talatona');expect(rpc.mock.calls[0][1]).toMatchObject({p_code:'AO-LDA-TAL-G10-ABC-DEF',p_lat:null});expect(rpc.mock.calls[0][1]).not.toHaveProperty('status');});
it('validates the GPS mode before saving',()=>{expect(validResidencePlan({method:'home'})).toBe(false);expect(validResidencePlan({method:'home',lat:1,lng:2,accuracy:1500})).toBe(false);expect(validResidencePlan({method:'later'})).toBe(true);});

it('localizes save errors without exposing database details',async()=>{
 for(const language of ['pt','en','fr','ar','am','sw','ln','yo','sn','zu']) {
  await changeAppLanguage(language);
  for(const [message,source] of [
   ['residence_cooldown','A mudança de Banda ainda está no período de espera.'],
   ['internal database detail','Não foi possível guardar a Banda. Tenta novamente.'],
  ]) {
   rpc.mockResolvedValueOnce({data:null,error:{message}});
   await expect(submitResidence({method:'later'},'AO','Luanda','Talatona')).rejects.toThrow(uiText(source));
   if(language!=='pt') expect(uiText(source)).not.toBe(source);
  }
 }
});

it('submits a remote residence as map with no claimed GPS accuracy or certification',async()=>{
 const plan={method:'map' as const,lat:-8.9,lng:13.2,mapConfirmed:true,accuracy:5,administrative:{province:'AO-LDA',municipality:'AO-LDA-TALATONA',commune:'AO-LDA-KTALATONA'}};
 await submitResidence(plan,'AO','Luanda','Talatona');
 expect(rpc).toHaveBeenCalledWith('submit_residence_administrative',expect.objectContaining({p_method:'map',p_lat:-8.9,p_lng:13.2,p_accuracy:null}));
 expect(validResidencePlan({...plan,mapConfirmed:false})).toBe(false);
 expect(validResidencePlan({...plan,lat:Infinity})).toBe(false);
 expect(validResidencePlan({...plan,lat:40})).toBe(false);
 await expect(submitResidence({...plan,administrative:undefined},'AO','Luanda','Talatona')).rejects.toThrow();
});
