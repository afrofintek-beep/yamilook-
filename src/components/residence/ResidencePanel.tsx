import { supabase } from '@/integrations/supabase/client';
import type { AdministrativeAddress } from '@/lib/angola-administrative';
import { AngolaAfrolocExperience } from './AngolaAfrolocExperience';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import { useAfrolocCertification } from '@/features/kumbu/hooks/useAfrolocCertification';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ResidenceForm } from './ResidenceForm';
import { submitResidence, type ResidencePlan } from '@/lib/residence';
import { Button } from '@/components/ui/button';
export function ResidencePanel() {
  useUiLocale();
 const {isCertified}=useAfrolocCertification();
 const {profile,refreshProfile}=useAuth(); const [open,setOpen]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 const [country,setCountry]=useState(profile?.country_code||'AO');const [city,setCity]=useState(profile?.city||'');const [neighborhood,setNeighborhood]=useState(profile?.neighborhood||'');const [custom,setCustom]=useState('');const [plan,setPlan]=useState<ResidencePlan>(profile?.afroloc_code?{method:'existing',code:profile.afroloc_code}:{method:'later'});
 useEffect(()=>{if(!open)return;let active=true;void (async()=>{try{const {data,error}=await supabase.rpc('my_residence_administrative' as never);if(error)throw error;if(active&&data)setPlan(p=>p.administrative?p:{...p,administrative:data as AdministrativeAddress});}catch{if(active)setError(uiText('Não foi possível carregar a divisão administrativa. Tenta novamente.'));}})();return()=>{active=false;};},[open]);
 const start=(method:'existing'|'away')=>{setCountry(profile?.country_code||'AO');setCity(profile?.city||'');setNeighborhood(profile?.neighborhood||'');setCustom('');setPlan({method,...(method==='existing'?{code:profile?.afroloc_code||''}:{})});setError('');setOpen(true);};
 const status=isCertified?uiText('Banda validada'):profile?.afroloc_code?uiText('Endereço associado — validação pendente'):uiText('Banda declarada — endereço por confirmar');
 const save=async()=>{setSaving(true);setError('');try{const result=await submitResidence(plan,country,city,neighborhood==='__other__'?custom:neighborhood) as {address_code?:string};await refreshProfile();setOpen(false);if(plan.method==='map'&&result?.address_code)window.location.assign('/afroloc/cartao');}catch(e){setError((e as Error).message);}finally{setSaving(false);}};
 return <section className="mx-4 mb-4 rounded-xl border p-4 space-y-3" aria-label={uiText("Validação da Banda")}><p className="font-medium text-sm">{status}</p><p className="text-xs text-muted-foreground">{uiText("Os benefícios territoriais dependem da validação. Uma viagem não muda a tua Banda de residência.")}</p>
 {!open&&<AngolaAfrolocExperience country={profile?.country_code} hasAddress={!!profile?.afroloc_code} onCreate={()=>start('away')} onExisting={()=>start('existing')} />}
 {!open&&<Button variant="outline" onClick={()=>start(profile?.afroloc_code?'existing':'away')}>{profile?.afroloc_certification_status==='certified'?uiText("Atualizar endereço de residência"):uiText("Validar a minha Banda")}</Button>}
 {open&&<><p className="text-xs text-muted-foreground">{uiText("Alterar o endereço inicia uma nova validação e está sujeito ao prazo de mudança de Banda.")}</p><ResidenceForm country={country} city={city} neighborhood={neighborhood} customNeighborhood={custom} onCountry={setCountry} onCity={setCity} onNeighborhood={setNeighborhood} onCustomNeighborhood={setCustom} plan={plan} onPlan={setPlan} onContinue={save} onBack={()=>setOpen(false)} saving={saving}/></>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </section>;
}
