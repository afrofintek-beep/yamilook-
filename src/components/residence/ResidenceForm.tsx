import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AFRICAN_LOCATIONS } from '@/lib/african-locations';
import { snapToGrid } from '@/lib/geo-privacy';
import { validResidencePlan, type ResidencePlan, type ResidenceMethod } from '@/lib/residence';
const options: { value: ResidenceMethod; key: string }[] = [
  { value: 'home', key: 'onboardingFlow.home' },
  { value: 'away', key: 'onboardingFlow.away' },
  { value: 'existing', key: 'onboardingFlow.existing' },
  { value: 'later', key: 'onboardingFlow.later' },
];
interface Props {
 country: string; city: string; neighborhood: string; customNeighborhood: string;
 onCountry: (v:string)=>void; onCity:(v:string)=>void; onNeighborhood:(v:string)=>void; onCustomNeighborhood:(v:string)=>void;
 plan: ResidencePlan; onPlan:(v:ResidencePlan)=>void; onContinue:()=>void; onBack?:()=>void; saving?:boolean;
}
export function ResidenceForm(p: Props) {
 const { t } = useTranslation();
 const [locating,setLocating]=useState(false); const [error,setError]=useState(''); const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const resetHomeCapture=()=>{if(p.plan.method==='home'){generation.current++;setLocating(false);p.onPlan({method:'home'});}};
 const country=AFRICAN_LOCATIONS.find(c=>c.countryCode===p.country);
 const neighborhoods=country?.cities.find(c=>c.name===p.city)?.neighborhoods || [];
 const changeMode=(method:ResidenceMethod)=>{generation.current++;setLocating(false);setError('');p.onPlan({method});};
 const locate=()=>{
  if(!navigator.geolocation){setError('onboardingFlow.locationUnavailable');return;}
  const request=++generation.current;setLocating(true);setError('');
  navigator.geolocation.getCurrentPosition(pos=>{
   if(request!==generation.current)return;setLocating(false);
   if(pos.coords.accuracy>1000){setError('onboardingFlow.weakSignal');return;}
   const cell=snapToGrid(pos.coords.latitude,pos.coords.longitude);
   p.onPlan({method:'home',lat:cell.lat,lng:cell.lng,accuracy:pos.coords.accuracy});
  },()=>{if(request!==generation.current)return;setLocating(false);setError('onboardingFlow.locationFailed');},
  {enableHighAccuracy:true,timeout:10000,maximumAge:0});
 };
 const valid=!!p.country&&!!p.city&&!!p.neighborhood&&(p.neighborhood!=='__other__'||!!p.customNeighborhood.trim())&&validResidencePlan(p.plan);
 const selectClass='w-full rounded-xl border bg-background px-3 py-3 text-base';
 return <div className="space-y-4 text-start">
  <h2 className="text-xl font-bold">{t("onboardingFlow.residenceTitle")}</h2>
  <p className="text-sm text-muted-foreground">{t("onboardingFlow.residenceHint")}</p>
  <label className="block text-sm">{t("onboardingFlow.country")}<select className={selectClass} value={p.country} onChange={e=>{resetHomeCapture();p.onCountry(e.target.value);p.onCity('');p.onNeighborhood('');}}>{AFRICAN_LOCATIONS.map(c=><option key={c.countryCode} value={c.countryCode}>{c.country}</option>)}</select></label>
  <label className="block text-sm">{t("onboardingFlow.city")}<select className={selectClass} value={p.city} onChange={e=>{resetHomeCapture();p.onCity(e.target.value);p.onNeighborhood('');}}><option value="">{t("onboardingFlow.selectCity")}</option>{country?.cities.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
  <label className="block text-sm">{t("onboardingFlow.neighborhood")}<select className={selectClass} value={p.neighborhood} onChange={e=>{resetHomeCapture();p.onNeighborhood(e.target.value);}}><option value="">{t("onboardingFlow.selectNeighborhood")}</option>{neighborhoods.map(n=><option key={n} value={n}>{n}</option>)}{p.neighborhood && p.neighborhood!=='__other__' && !neighborhoods.includes(p.neighborhood) && <option value={p.neighborhood}>{p.neighborhood}</option>}<option value="__other__">{t("onboardingFlow.otherNeighborhood")}</option></select></label>
  {p.neighborhood==='__other__'&&<Input aria-label={t("onboardingFlow.neighborhoodName")} value={p.customNeighborhood} onChange={e=>p.onCustomNeighborhood(e.target.value)} placeholder={t("onboardingFlow.neighborhoodName")}/>}
  <fieldset className="space-y-2"><legend className="font-medium mb-2">{t("onboardingFlow.atAddress")}</legend>{options.map(o=><label key={o.value} className="flex gap-3 items-center rounded-xl border p-3 text-sm"><input type="radio" name="residence-method" value={o.value} checked={p.plan.method===o.value} onChange={()=>changeMode(o.value)}/>{t(o.key)}</label>)}</fieldset>
  {p.plan.method==='home'&&<div className="space-y-2"><Button type="button" variant="outline" onClick={locate} disabled={locating}>{locating?t("onboardingFlow.locating"):p.plan.lat!==undefined?t("onboardingFlow.updateLocation"):t("onboardingFlow.captureLocation")}</Button>{p.plan.accuracy&&<p role="status" className="text-sm">{t('onboardingFlow.locationCaptured', { accuracy: Math.ceil(p.plan.accuracy) })}</p>}</div>}
  {p.plan.method==='existing'&&<><Input aria-label={t("onboardingFlow.existingCode")} value={p.plan.code||''} onChange={e=>p.onPlan({method:'existing',code:e.target.value.toUpperCase()})} placeholder={t("onboardingFlow.enterCode")} autoCapitalize="characters"/><p className="text-xs text-muted-foreground">{t("onboardingFlow.codeHint")}</p></>}
  {(p.plan.method==='away'||p.plan.method==='later')&&<p className="text-sm text-muted-foreground">{t("onboardingFlow.confirmLaterHint")}</p>}
  <p className="text-xs text-muted-foreground">{t("onboardingFlow.residenceNotice")}</p>
  {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  <div className="flex flex-wrap gap-3">{p.onBack&&<Button variant="outline" onClick={p.onBack} disabled={p.saving}>{t("common.back")}</Button>}<Button onClick={p.onContinue} disabled={!valid||locating||p.saving}>{p.saving?t("common.saving"):t("onboardingFlow.confirmBanda")}</Button></div>
 </div>;
}
