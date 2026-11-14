import { AdministrativeFields } from './AdministrativeFields';
import { administrativeFromCode, emptyAdministrativeAddress, validAdministrativeAddress, administrativeCodeMismatch, divisions } from '@/lib/angola-administrative';
import { ExistingAfrolocAddress } from './ExistingAfrolocAddress';
import { uiText, useUiLocale } from '@/i18n/ui-copy';
import locationHints from '@/i18n/location-labels.json';
import { RESIDENCE_COUNTRY_CODES, loadResidenceCities, matchingResidenceCities } from '@/lib/residence-locations';
import { useTranslation } from 'react-i18next';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { localizedCountryName } from '@/lib/localized-country-name';
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
  useUiLocale();
 const { t, i18n } = useTranslation();
 const language = i18n.resolvedLanguage || i18n.language;
 const locale = language.toLowerCase().split(/[-_]/)[0] as keyof typeof locationHints;
 const cityListId = useId();
 const [cityData, setCityData] = useState<{country: string; cities: string[]}>({country: '', cities: []});
 const countryCodes = useMemo(() => [...RESIDENCE_COUNTRY_CODES].sort((a,b) => localizedCountryName(a,language).localeCompare(localizedCountryName(b,language),locale)), [language, locale]);
 useEffect(() => {
  let active = true;
  loadResidenceCities(p.country).then(cities => { if (active) setCityData({country:p.country,cities}); }).catch(() => { if (active) setCityData({country:p.country,cities:[]}); });
  return () => { active = false; };
 }, [p.country]);
 const suggestions = useMemo(() => matchingResidenceCities(cityData.country === p.country ? cityData.cities : [],p.city,language), [cityData, p.country, p.city, language]);
 const [locating,setLocating]=useState(false); const [error,setError]=useState(''); const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 const resetHomeCapture=()=>{if(p.plan.method==='home'){generation.current++;setLocating(false);p.onPlan({method:'home',administrative:p.plan.administrative});}};
 const country=AFRICAN_LOCATIONS.find(c=>c.countryCode===p.country);
 const neighborhoods=country?.cities.find(c=>c.name===p.city)?.neighborhoods || [];
 const changeMode=(method:ResidenceMethod)=>{generation.current++;setLocating(false);setError('');p.onPlan({method,administrative:p.plan.administrative});};
 const locate=()=>{
  if(!navigator.geolocation){setError("onboardingFlow.locationUnavailable");return;}
  const request=++generation.current;setLocating(true);setError('');
  navigator.geolocation.getCurrentPosition(pos=>{
   if(request!==generation.current)return;setLocating(false);
   if(pos.coords.accuracy>1000){setError("onboardingFlow.weakSignal");return;}
   const cell=snapToGrid(pos.coords.latitude,pos.coords.longitude);
   p.onPlan({method:'home',administrative:p.plan.administrative,lat:cell.lat,lng:cell.lng,accuracy:pos.coords.accuracy});
  },()=>{if(request!==generation.current)return;setLocating(false);setError("onboardingFlow.locationFailed");},
  {enableHighAccuracy:true,timeout:10000,maximumAge:0});
 };
 const admin=p.plan.administrative;
 const mismatch=p.plan.method==='existing'&&administrativeCodeMismatch(p.plan.code||'',admin);
 const adminValid=(!admin&&p.plan.method==='later')||validAdministrativeAddress(admin);
 const valid=!mismatch&&adminValid&&!!p.country&&!!p.city.trim()&&!!p.neighborhood&&(p.neighborhood!=='__other__'||!!p.customNeighborhood.trim())&&validResidencePlan(p.plan);
 const isAngola=p.country.trim().toUpperCase()==='AO';
 const choice=p.plan.method==='existing'?'existing':p.plan.method==='later'?'later':'create';
 const missing=mismatch ? uiText('O código AFROLOC não corresponde à divisão administrativa escolhida. Confirma os dados.') : !adminValid ? uiText('Selecciona a província, o município e a comuna, quando exista.') : !p.country ? uiText("Selecciona o país.") : !p.city.trim() ? uiText("Indica a cidade ou localidade.") : !p.neighborhood || (p.neighborhood==='__other__'&&!p.customNeighborhood.trim()) ? uiText("Indica o bairro.") : p.plan.method==='existing'&&!validResidencePlan(p.plan) ? uiText("Introduz um código AFROLOC válido ou carrega uma imagem do cartão com um QR legível.") : p.plan.method==='home'&&!validResidencePlan(p.plan) ? uiText("Capta a localização do teu endereço para continuar.") : '';
 const capture=<div className="space-y-2"><Button type="button" variant="outline" className="h-auto whitespace-normal" onClick={locate} disabled={locating||p.saving}>{locating?t("onboardingFlow.locating"):p.plan.lat!==undefined?t("onboardingFlow.updateLocation"):t("onboardingFlow.captureLocation")}</Button>{p.plan.accuracy&&<p role="status" className="text-sm">{t('onboardingFlow.locationCaptured', { accuracy: Math.ceil(p.plan.accuracy) })}</p>}</div>;
 const selectClass='w-full rounded-xl border bg-background px-3 py-3 text-base';
 return <div className="space-y-4 text-start">
  <h2 className="text-xl font-bold">{isAngola?uiText("Qual é a tua Banda de residência?"):t("onboardingFlow.residenceTitle")}</h2>
  <p className="text-sm text-muted-foreground">{isAngola?uiText("Indica onde vives, mesmo que agora estejas noutro local."):t("onboardingFlow.residenceHint")}</p>
  <label className="block text-sm">{t("onboardingFlow.country")}<select className={selectClass} value={p.country} onChange={e=>{resetHomeCapture();p.onPlan({method:'later'});p.onCountry(e.target.value);p.onCity('');p.onNeighborhood('');p.onCustomNeighborhood('');}}>{countryCodes.map(code=><option key={code} value={code}>{localizedCountryName(code, language)}</option>)}</select></label>
  {isAngola ? <>
   <AdministrativeFields value={admin||emptyAdministrativeAddress} disabled={p.saving} onChange={administrative=>{if(!p.city&&administrative.municipality)p.onCity(divisions.find(d=>d.code===administrative.municipality)?.name||'');resetHomeCapture();p.onPlan({...p.plan,lat:undefined,lng:undefined,accuracy:undefined,administrative:administrative.province?administrative:undefined});}}/>
   {!admin&&<p className="text-xs text-muted-foreground">{uiText('Podes completar a divisão administrativa mais tarde. Os dados anteriores são mantidos.')}</p>}
   <label className="block text-sm">{uiText('Cidade / localidade (informação complementar)')}<Input maxLength={100} value={p.city} onChange={e=>p.onCity(e.target.value)}/></label>
   <label className="block text-sm">{uiText('Bairro / povoação / localidade')}<Input maxLength={150} value={p.neighborhood==='__other__'?p.customNeighborhood:p.neighborhood} onChange={e=>{p.onNeighborhood(e.target.value);p.onCustomNeighborhood('');}}/></label>
   <label className="block text-sm">{uiText('Complemento do endereço (opcional)')}<Input maxLength={250} value={admin?.complement||''} onChange={e=>p.onPlan({...p.plan,administrative:{...(admin||emptyAdministrativeAddress),complement:e.target.value}})}/></label>
   <p className="text-xs text-muted-foreground">{uiText('A divisão administrativa é declarada. A correspondência com os limites no mapa fica por verificar.')}</p>
  </> : <>
  <label className="block text-sm">{t("onboardingFlow.city")}<Input list={cityListId} autoComplete="address-level2" maxLength={200} className={selectClass} value={p.city} aria-describedby={`${cityListId}-hint`} onChange={e=>{resetHomeCapture();p.onCity(e.target.value);p.onNeighborhood('');p.onCustomNeighborhood('');}} placeholder={t("onboardingFlow.selectCity")}/></label>
  <datalist id={cityListId}>{suggestions.map(name=><option key={name} value={name}/>)}</datalist>
  <p id={`${cityListId}-hint`} className="text-xs text-muted-foreground">{locationHints[locale] || locationHints.pt}</p>
  <p className="text-xs text-muted-foreground"><a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline">{uiText("GeoNames")}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">{uiText("CC BY 4.0")}</a></p>
  <label className="block text-sm">{t("onboardingFlow.neighborhood")}<select className={selectClass} value={p.neighborhood} onChange={e=>{resetHomeCapture();p.onNeighborhood(e.target.value);}}><option value="">{t("onboardingFlow.selectNeighborhood")}</option>{neighborhoods.map(n=><option key={n} value={n}>{n}</option>)}{p.neighborhood && p.neighborhood!=='__other__' && !neighborhoods.includes(p.neighborhood) && <option value={p.neighborhood}>{p.neighborhood}</option>}<option value="__other__">{t("onboardingFlow.otherNeighborhood")}</option></select></label>
  {p.neighborhood==='__other__'&&<Input aria-label={t("onboardingFlow.neighborhoodName")} value={p.customNeighborhood} onChange={e=>p.onCustomNeighborhood(e.target.value)} placeholder={t("onboardingFlow.neighborhoodName")}/>}
  </>}
  {isAngola ? <fieldset className="space-y-3" disabled={p.saving}>
   <legend className="font-semibold mb-2">{uiText('Já tens um endereço AFROLOC?')}</legend>
   <p className="text-sm text-muted-foreground">{uiText('Podes concluir a inscrição e tratar do endereço mais tarde no teu perfil.')}</p>
   {([['existing',uiText('Já tenho um endereço AFROLOC')],['create',uiText('Quero criar um endereço')],['later',uiText('Fazer mais tarde')]] as const).map(([value,label])=><div key={value} className="min-w-0 rounded-xl border p-3 space-y-3">
    <label className="flex items-center gap-3 text-sm"><input type="radio" name={`${cityListId}-address-choice`} className="shrink-0 accent-primary" checked={choice===value} onChange={()=>changeMode(value==='create'?'away':value)}/><span>{label}</span></label>
    {choice===value && value==='existing' && <ExistingAfrolocAddress code={p.plan.code||''} onChange={code=>p.onPlan({method:'existing',code,administrative:administrativeFromCode(code)||p.plan.administrative})} disabled={p.saving}/>}
    {choice===value && value==='create' && <div className="space-y-3">
     <fieldset className="space-y-2"><legend className="text-sm font-medium mb-2">{uiText('Estás neste momento na tua residência?')}</legend>{options.filter(o=>o.value==='home'||o.value==='away').map(o=><label key={o.value} className="flex gap-3 items-center text-sm"><input className="accent-primary" type="radio" name={`${cityListId}-presence`} checked={p.plan.method===o.value} onChange={()=>changeMode(o.value)}/>{t(o.key)}</label>)}</fieldset>
     {p.plan.method==='home'?capture:<p className="text-sm text-muted-foreground">{uiText('Podes guardar a Banda agora. Cria o endereço quando estiveres no local da tua residência.')}</p>}
    </div>}
    {choice===value && value==='later' && <p className="text-sm text-muted-foreground">{t('onboardingFlow.confirmLaterHint')}</p>}
   </div>)}
  </fieldset> : <>
   <fieldset className="space-y-2"><legend className="font-medium mb-2">{t("onboardingFlow.atAddress")}</legend>{options.map(o=><label key={o.value} className="flex gap-3 items-center rounded-xl border p-3 text-sm"><input type="radio" name={`${cityListId}-residence-method`} value={o.value} checked={p.plan.method===o.value} onChange={()=>changeMode(o.value)}/>{t(o.key)}</label>)}</fieldset>
   {p.plan.method==='home'&&capture}
   {p.plan.method==='existing'&&<><Input aria-label={t("onboardingFlow.existingCode")} value={p.plan.code||''} onChange={e=>p.onPlan({method:'existing',code:e.target.value.toUpperCase()})} placeholder={t("onboardingFlow.enterCode")} autoCapitalize="characters"/><p className="text-xs text-muted-foreground">{t("onboardingFlow.codeHint")}</p></>}
   {(p.plan.method==='away'||p.plan.method==='later')&&<p className="text-sm text-muted-foreground">{t("onboardingFlow.confirmLaterHint")}</p>}
  </>}
  <p className="text-xs text-muted-foreground">{t("onboardingFlow.residenceNotice")}</p>
  {error&&<p role="alert" className="text-sm text-destructive">{t(error)}</p>}
  {missing&&<p id={`${cityListId}-missing`} role="status" className="text-sm text-muted-foreground">{missing}</p>}
  <div className="flex flex-wrap gap-3">{p.onBack&&<Button variant="outline" onClick={p.onBack} disabled={p.saving}>{t("common.back")}</Button>}<Button className="h-auto whitespace-normal" aria-describedby={missing?`${cityListId}-missing`:undefined} onClick={p.onContinue} disabled={!valid||locating||p.saving}>{p.saving?t("common.saving"):t("onboardingFlow.confirmBanda")}</Button></div>
 </div>;
}
