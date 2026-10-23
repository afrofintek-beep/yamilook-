import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AFRICAN_LOCATIONS } from '@/lib/african-locations';
import { snapToGrid } from '@/lib/geo-privacy';
import { validResidencePlan, type ResidencePlan, type ResidenceMethod } from '@/lib/residence';
const options: { value: ResidenceMethod; label: string }[] = [
  { value: 'home', label: 'Sim, estou no meu endereço' },
  { value: 'away', label: 'Não, estou noutro local' },
  { value: 'existing', label: 'Já tenho um endereço AFROLOC' },
  { value: 'later', label: 'Confirmar mais tarde' },
];
interface Props {
 country: string; city: string; neighborhood: string; customNeighborhood: string;
 onCountry: (v:string)=>void; onCity:(v:string)=>void; onNeighborhood:(v:string)=>void; onCustomNeighborhood:(v:string)=>void;
 plan: ResidencePlan; onPlan:(v:ResidencePlan)=>void; onContinue:()=>void; onBack?:()=>void; saving?:boolean;
}
export function ResidenceForm(p: Props) {
 const [locating,setLocating]=useState(false); const [error,setError]=useState(''); const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const resetHomeCapture=()=>{if(p.plan.method==='home'){generation.current++;setLocating(false);p.onPlan({method:'home'});}};
 const country=AFRICAN_LOCATIONS.find(c=>c.countryCode===p.country);
 const neighborhoods=country?.cities.find(c=>c.name===p.city)?.neighborhoods || [];
 const changeMode=(method:ResidenceMethod)=>{generation.current++;setLocating(false);setError('');p.onPlan({method});};
 const locate=()=>{
  if(!navigator.geolocation){setError('Localização indisponível. Podes confirmar mais tarde.');return;}
  const request=++generation.current;setLocating(true);setError('');
  navigator.geolocation.getCurrentPosition(pos=>{
   if(request!==generation.current)return;setLocating(false);
   if(pos.coords.accuracy>1000){setError('Sinal fraco. Tenta novamente ou confirma mais tarde.');return;}
   const cell=snapToGrid(pos.coords.latitude,pos.coords.longitude);
   p.onPlan({method:'home',lat:cell.lat,lng:cell.lng,accuracy:pos.coords.accuracy});
  },()=>{if(request!==generation.current)return;setLocating(false);setError('Não foi possível captar a localização. Podes confirmar mais tarde.');},
  {enableHighAccuracy:true,timeout:10000,maximumAge:0});
 };
 const valid=!!p.country&&!!p.city&&!!p.neighborhood&&(p.neighborhood!=='__other__'||!!p.customNeighborhood.trim())&&validResidencePlan(p.plan);
 const selectClass='w-full rounded-xl border bg-background px-3 py-3 text-base';
 return <div className="space-y-4 text-left">
  <h2 className="text-xl font-bold">A tua Banda de residência</h2>
  <p className="text-sm text-muted-foreground">Escolhe onde resides, mesmo que estejas em viagem ou no trabalho.</p>
  <label className="block text-sm">País<select className={selectClass} value={p.country} onChange={e=>{resetHomeCapture();p.onCountry(e.target.value);p.onCity('');p.onNeighborhood('');}}>{AFRICAN_LOCATIONS.map(c=><option key={c.countryCode} value={c.countryCode}>{c.country}</option>)}</select></label>
  <label className="block text-sm">Cidade<select className={selectClass} value={p.city} onChange={e=>{resetHomeCapture();p.onCity(e.target.value);p.onNeighborhood('');}}><option value="">Selecionar cidade</option>{country?.cities.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
  <label className="block text-sm">Bairro<select className={selectClass} value={p.neighborhood} onChange={e=>{resetHomeCapture();p.onNeighborhood(e.target.value);}}><option value="">Selecionar bairro</option>{neighborhoods.map(n=><option key={n} value={n}>{n}</option>)}{p.neighborhood && p.neighborhood!=='__other__' && !neighborhoods.includes(p.neighborhood) && <option value={p.neighborhood}>{p.neighborhood}</option>}<option value="__other__">Outro bairro</option></select></label>
  {p.neighborhood==='__other__'&&<Input aria-label="Nome do teu bairro" value={p.customNeighborhood} onChange={e=>p.onCustomNeighborhood(e.target.value)} placeholder="Nome do teu bairro"/>}
  <fieldset className="space-y-2"><legend className="font-medium mb-2">Estás agora no endereço que queres associar à tua Banda?</legend>{options.map(o=><label key={o.value} className="flex gap-3 items-center rounded-xl border p-3 text-sm"><input type="radio" name="residence-method" value={o.value} checked={p.plan.method===o.value} onChange={()=>changeMode(o.value)}/>{o.label}</label>)}</fieldset>
  {p.plan.method==='home'&&<div className="space-y-2"><Button type="button" variant="outline" onClick={locate} disabled={locating}>{locating?'A captar…':p.plan.lat!==undefined?'Atualizar localização':'Captar localização do meu endereço'}</Button>{p.plan.accuracy&&<p role="status" className="text-sm">Localização captada. Precisão indicada pelo dispositivo: cerca de {Math.ceil(p.plan.accuracy)} m. A validação da residência fica pendente.</p>}</div>}
  {p.plan.method==='existing'&&<><Input aria-label="Código AFROLOC existente" value={p.plan.code||''} onChange={e=>p.onPlan({method:'existing',code:e.target.value.toUpperCase()})} placeholder="Introduz o teu código AFROLOC" autoCapitalize="characters"/><p className="text-xs text-muted-foreground">O código identifica o endereço. O direito de utilização será verificado antes da certificação.</p></>}
  {(p.plan.method==='away'||p.plan.method==='later')&&<p className="text-sm text-muted-foreground">Podes concluir a inscrição e participar. Confirma o endereço mais tarde em Perfil → Validar a minha Banda.</p>}
  <p className="text-xs text-muted-foreground">A presença atual não prova residência. Os benefícios territoriais exigem uma Banda validada; viajar não altera automaticamente a tua Banda.</p>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  <div className="flex flex-wrap gap-3">{p.onBack&&<Button variant="outline" onClick={p.onBack} disabled={p.saving}>Voltar</Button>}<Button onClick={p.onContinue} disabled={!valid||locating||p.saving}>{p.saving?'A guardar…':'Confirmar Banda e continuar'}</Button></div>
 </div>;
}
