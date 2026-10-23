import { useAfrolocCertification } from '@/features/kumbu/hooks/useAfrolocCertification';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { ResidenceForm } from './ResidenceForm';
import { submitResidence, type ResidencePlan } from '@/lib/residence';
import { Button } from '@/components/ui/button';
export function ResidencePanel() {
 const {isCertified}=useAfrolocCertification();
 const {profile,refreshProfile}=useAuth(); const [open,setOpen]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');
 const [country,setCountry]=useState(profile?.country_code||'AO');const [city,setCity]=useState(profile?.city||'');const [neighborhood,setNeighborhood]=useState(profile?.neighborhood||'');const [custom,setCustom]=useState('');const [plan,setPlan]=useState<ResidencePlan>({method:'later'});
 const status=isCertified?'Banda validada':profile?.afroloc_code?'Endereço associado — validação pendente':'Banda declarada — endereço por confirmar';
 const save=async()=>{setSaving(true);setError('');try{await submitResidence(plan,country,city,neighborhood==='__other__'?custom:neighborhood);await refreshProfile();setOpen(false);}catch(e){setError((e as Error).message);}finally{setSaving(false);}};
 return <section className="mx-4 mb-4 rounded-xl border p-4 space-y-3" aria-label="Validação da Banda"><p className="font-medium text-sm">{status}</p><p className="text-xs text-muted-foreground">Os benefícios territoriais dependem da validação. Uma viagem não muda a tua Banda de residência.</p>
 {!open&&<Button variant="outline" onClick={()=>setOpen(true)}>{profile?.afroloc_certification_status==='certified'?'Atualizar endereço de residência':'Validar a minha Banda'}</Button>}
 {open&&<><p className="text-xs text-muted-foreground">Alterar o endereço inicia uma nova validação e está sujeito ao prazo de mudança de Banda.</p><ResidenceForm country={country} city={city} neighborhood={neighborhood} customNeighborhood={custom} onCountry={setCountry} onCity={setCity} onNeighborhood={setNeighborhood} onCustomNeighborhood={setCustom} plan={plan} onPlan={setPlan} onContinue={save} onBack={()=>setOpen(false)} saving={saving}/></>}
 {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
 </section>;
}
