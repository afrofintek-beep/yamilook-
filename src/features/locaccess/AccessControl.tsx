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
 const [query,setQuery]=useState(''),[people,setPeople]=useState<AccessPerson[]>([]);
 const [radius,setRadius]=useState('500'),[hours,setHours]=useState('24');
 const [submitting,setSubmitting]=useState(false),[outcome,setOutcome]=useState<{count:number;failed:boolean}|null>(null);
 const submittingRef=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 const locked=control.busy||submitting;
 const toggle=(person:AccessPerson)=>{if(locked)return;setOutcome(null);setPeople(previous=>previous.some(p=>p.id===person.id)?previous.filter(p=>p.id!==person.id):[...previous,person]);};
 const authorize=async()=>{
  if(submittingRef.current||control.busy||!control.policy||!people.length)return;
  submittingRef.current=true;setSubmitting(true);setOutcome(null);
  let count=0;
  try{
   for(const person of people){
    if(!alive.current)break;
    await control.change('grant',{username:person.username,recipient_id:person.id,radius:Number(radius),hours:Number(hours)});
    count++;
    if(alive.current)setPeople(previous=>previous.filter(p=>p.id!==person.id));
   }
   if(alive.current){setOutcome({count,failed:false});setQuery('');}
  }catch{if(alive.current)setOutcome({count,failed:true});}
  finally{submittingRef.current=false;if(alive.current)setSubmitting(false);}
 };
 const grants=control.policy?.grants||[];
 return <section className="locaccess-panel" aria-label="LOCACCESS">
  <header className="locaccess-heading"><span className="locaccess-eyebrow">{t("LOCACCESS · Experimental")}</span><h2><ShieldCheck aria-hidden="true" size={22}/>{t("Acesso à minha morada")}</h2><span className="locaccess-state">{grants.length?t('Acessos autorizados: {{count}}',{count:grants.length}):t('Fechado a terceiros')}</span></header>
  <p className="text-sm text-muted-foreground">{t("Só as pessoas que autorizares podem consultar a localização. A distância e a validade escolhidas aplicam-se a todas as pessoas seleccionadas. Podes fechar cada acesso individualmente.")}</p>
  {control.error&&<p role="alert" className="text-sm">{t(control.error)} <button className="underline" onClick={control.retry}>{t("Tentar novamente")}</button></p>}
  {control.busy&&!control.policy&&<p role="status">{t("A preparar o acesso protegido…")}</p>}

   <form className="locaccess-form" aria-label={t("Escolher quem pode aceder")} onSubmit={e=>{e.preventDefault();void authorize()}}>
    <PersonSearch query={query} selected={people} onQuery={setQuery} onSelect={toggle} disabled={locked}/>
    {people.length>0&&<div><p role="status">{t('Pessoas seleccionadas: {{count}}',{count:people.length})}</p><ul className="mt-2 flex flex-wrap gap-2">
     {people.map(person=><li key={person.id}><button type="button" disabled={locked} className="min-h-11 max-w-full rounded-lg border px-3 py-2 text-sm" aria-label={t('Retirar {{name}} da selecção',{name:person.display_name||person.username})} onClick={()=>toggle(person)}>{person.display_name||person.username} <span dir="ltr">@{person.username.replace(/^@+/,'')}</span> ×</button></li>)}
    </ul></div>}
    <div className="locaccess-options"><label className="grid gap-1 text-sm">{t("Revelar a morada")}<select className="locaccess-select" disabled={locked} value={radius} onChange={e=>setRadius(e.target.value)}><option value="100">{t("A 100 metros")}</option><option value="250">{t("A 250 metros")}</option><option value="500">{t("A 500 metros")}</option><option value="0">{t("Imediatamente")}</option></select></label>
    <label className="grid gap-1 text-sm">{t("Validade")}<select className="locaccess-select" disabled={locked} value={hours} onChange={e=>setHours(e.target.value)}><option value="1">{t("1 hora")}</option><option value="24">{t("24 horas")}</option><option value="168">{t("7 dias")}</option></select></label></div>
    <Button className="locaccess-authorize" disabled={locked||!control.policy||!people.length}>{people.length>1?t('Autorizar pessoas seleccionadas ({{count}})',{count:people.length}):t("Autorizar pessoa seleccionada")}</Button>
    <p className="locaccess-confirmation">{t("Pesquisar e seleccionar não concede acesso. Confirma no botão acima.")}</p>
   </form>
  {outcome&&<p role={outcome.failed?'alert':'status'}>{t(outcome.failed?'Acessos autorizados: {{count}}. Não foi possível concluir. As pessoas restantes continuam seleccionadas.':'Acessos autorizados: {{count}}.',{count:outcome.count})}</p>}
  {grants.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><div className="text-sm"><strong>@{g.username.replace(/^@+/,'')}</strong><p>{t('{{mode}} · até {{date}}',{mode:g.radius?t('{{distance}} metros',{distance:g.radius}):t('Imediato'),date:new Date(g.expiresAt).toLocaleString(locale==='pt-banda'?'pt-AO':locale,{timeZone:'Africa/Luanda'})})}</p></div><Button variant="outline" disabled={locked} onClick={()=>void control.change('revoke',{grant_id:g.id}).catch(()=>{})}>{t("Fechar acesso")}</Button></div>)}
  {grants.length>0&&<Button variant="link" className="locaccess-close" disabled={locked} onClick={()=>void control.change('close').catch(()=>{})}>{t("Fechar todos os acessos")}</Button>}
  <p className="locaccess-note">{t("O acesso à tua morada respeita as autorizações, a distância e a validade que definires. A proximidade indicada não comprova presença física. Ao fechar o acesso, novas consultas são bloqueadas e a localização é ocultada em até 20 segundos. Esta acção não elimina informações já consultadas ou partilhadas.")}</p>
 </section>;
}
