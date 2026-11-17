import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import {useEffect,useRef,useState} from 'react';
import {PersonSearch,type AccessPerson} from './PersonSearch';
import {Button} from '@/components/ui/button';
import {ShieldCheck} from 'lucide-react';
import './access-control.css';
import {accessLink,locaccess,validHandle,type Policy} from './api';
export function useAccessControl(id:string|undefined,code:string|undefined){
 const key=JSON.stringify([id,code]);const current=useRef(key);current.current=key;
 const [snapshot,setSnapshot]=useState<{key:string;policy:Policy}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [retry,setRetry]=useState(0);
 useEffect(()=>{if(!id||!code)return;let active=true;setBusy(true);setError('');
  void locaccess('owner',{id,code}).then(policy=>{if(!validHandle(policy?.handle)||!Array.isArray(policy.grants))throw new Error('Não foi possível preparar o acesso.');if(active)setSnapshot({key,policy})}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false};
 },[id,code,key,retry]);
 const policy=snapshot?.key===key?snapshot.policy:null;
 const change=async(action:string,data:Record<string,unknown>={})=>{if(busy||!id||!code)return;setBusy(true);setError('');try{const policy=await locaccess(action,{id,code,...data});if(current.current===key)setSnapshot({key,policy})}catch(e){if(current.current===key)setError((e as Error).message);throw e}finally{if(current.current===key)setBusy(false)}};
 return {policy,url:policy?accessLink(policy.handle):'',busy,error,change,retry:()=>setRetry(n=>n+1)};
}
export function AccessControl({control}:{control:ReturnType<typeof useAccessControl>}){
 const locale=useUiLocale();
 const [query,setQuery]=useState(''),[person,setPerson]=useState<AccessPerson|null>(null);
 const [radius,setRadius]=useState('500'),[hours,setHours]=useState('24');
 const grants=control.policy?.grants||[];
 return <section className="locaccess-panel" aria-label="LOCACCESS">
  <header className="locaccess-heading"><span className="locaccess-eyebrow">{t("LOCACCESS · Experimental")}</span><h2><ShieldCheck aria-hidden="true" size={22}/>{t("Acesso à minha morada")}</h2><span className="locaccess-state">{grants.length?t('Acessos autorizados: {{count}}',{count:grants.length}):t('Fechado a terceiros')}</span></header>
  <p className="text-sm text-muted-foreground">{t("Só a conta Yamilook escolhida pode consultar a localização. Imediato significa acesso sem limite de distância para essa pessoa.")}</p>
  {control.error&&<p role="alert" className="text-sm">{t(control.error)} <button className="underline" onClick={control.retry}>{t("Tentar novamente")}</button></p>}
  {control.busy&&!control.policy&&<p role="status">{t("A preparar o acesso protegido…")}</p>}

   <form className="locaccess-form" aria-label={t("Escolher quem pode aceder")} onSubmit={e=>{e.preventDefault();if(!person||control.busy)return;void control.change('grant',{username:person.username,recipient_id:person.id,radius:Number(radius),hours:Number(hours)}).then(()=>{setQuery('');setPerson(null)}).catch(()=>{})}}>
    <PersonSearch query={query} selected={person} onQuery={value=>{setQuery(value);setPerson(null)}} onSelect={value=>{setPerson(value);setQuery('@'+value.username)}} disabled={control.busy}/>
    <div className="locaccess-options"><label className="grid gap-1 text-sm">{t("Revelar a morada")}<select className="locaccess-select" disabled={control.busy} value={radius} onChange={e=>setRadius(e.target.value)}><option value="100">{t("A 100 metros")}</option><option value="250">{t("A 250 metros")}</option><option value="500">{t("A 500 metros")}</option><option value="0">{t("Imediatamente")}</option></select></label>
    <label className="grid gap-1 text-sm">{t("Validade")}<select className="locaccess-select" disabled={control.busy} value={hours} onChange={e=>setHours(e.target.value)}><option value="1">{t("1 hora")}</option><option value="24">{t("24 horas")}</option><option value="168">{t("7 dias")}</option></select></label></div>
    <Button className="locaccess-authorize" disabled={control.busy||!control.policy||!person}>{t("Autorizar pessoa seleccionada")}</Button>
    <p className="locaccess-confirmation">{t("Pesquisar e seleccionar não concede acesso. Confirma no botão acima.")}</p>
   </form>
  {grants.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><div className="text-sm"><strong>@{g.username}</strong><p>{t('{{mode}} · até {{date}}',{mode:g.radius?t('{{distance}} metros',{distance:g.radius}):t('Imediato'),date:new Date(g.expiresAt).toLocaleString(locale==='pt-banda'?'pt-AO':locale,{timeZone:'Africa/Luanda'})})}</p></div><Button variant="outline" disabled={control.busy} onClick={()=>void control.change('revoke',{grant_id:g.id}).catch(()=>{})}>{t("Fechar acesso")}</Button></div>)}
  {grants.length>0&&<Button variant="link" className="locaccess-close" disabled={control.busy} onClick={()=>void control.change('close').catch(()=>{})}>{t("Fechar todos os acessos")}</Button>}
  <p className="locaccess-note">{t("O acesso à tua morada respeita as autorizações, a distância e a validade que definires. A proximidade indicada não comprova presença física. Ao fechar o acesso, novas consultas são bloqueadas e a localização é ocultada em até 20 segundos. Esta acção não elimina informações já consultadas ou partilhadas.")}</p>
 </section>;
}
