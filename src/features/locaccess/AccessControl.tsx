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
 const [query,setQuery]=useState(''),[person,setPerson]=useState<AccessPerson|null>(null);
 const [radius,setRadius]=useState('500'),[hours,setHours]=useState('24');
 const grants=control.policy?.grants||[];
 return <section className="locaccess-panel" aria-label="LOCACCESS">
  <header className="locaccess-heading"><span className="locaccess-eyebrow">LOCACCESS · Experimental</span><h2><ShieldCheck aria-hidden="true" size={22}/>Acesso à minha morada</h2><span className="locaccess-state">{grants.length?`${grants.length} acesso(s) autorizado(s)`:'Fechado a terceiros'}</span></header>
  <p className="text-sm text-muted-foreground">Só a conta Yamilook escolhida pode consultar a localização. Imediato significa acesso sem limite de distância para essa pessoa.</p>
  {control.error&&<p role="alert" className="text-sm">{control.error} <button className="underline" onClick={control.retry}>Tentar novamente</button></p>}
  {control.busy&&!control.policy&&<p role="status">A preparar o acesso protegido…</p>}

   <form className="locaccess-form" aria-label="Escolher quem pode aceder" onSubmit={e=>{e.preventDefault();if(!person||control.busy)return;void control.change('grant',{username:person.username,recipient_id:person.id,radius:Number(radius),hours:Number(hours)}).then(()=>{setQuery('');setPerson(null)}).catch(()=>{})}}>
    <PersonSearch query={query} selected={person} onQuery={value=>{setQuery(value);setPerson(null)}} onSelect={value=>{setPerson(value);setQuery('@'+value.username)}} disabled={control.busy}/>
    <div className="locaccess-options"><label className="grid gap-1 text-sm">Revelar a morada<select className="locaccess-select" disabled={control.busy} value={radius} onChange={e=>setRadius(e.target.value)}><option value="100">A 100 metros</option><option value="250">A 250 metros</option><option value="500">A 500 metros</option><option value="0">Imediatamente</option></select></label>
    <label className="grid gap-1 text-sm">Validade<select className="locaccess-select" disabled={control.busy} value={hours} onChange={e=>setHours(e.target.value)}><option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 dias</option></select></label></div>
    <Button className="locaccess-authorize" disabled={control.busy||!control.policy||!person}>Autorizar pessoa seleccionada</Button>
    <p className="locaccess-confirmation">Pesquisar e seleccionar não concede acesso. Confirma no botão acima.</p>
   </form>
  {grants.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><div className="text-sm"><strong>@{g.username}</strong><p>{g.radius?`${g.radius} metros`:'Imediato'} · até {new Date(g.expiresAt).toLocaleString('pt-PT',{timeZone:'Africa/Luanda'})}</p></div><Button variant="outline" disabled={control.busy} onClick={()=>void control.change('revoke',{grant_id:g.id}).catch(()=>{})}>Fechar acesso</Button></div>)}
  {grants.length>0&&<Button variant="link" className="locaccess-close" disabled={control.busy} onClick={()=>void control.change('close').catch(()=>{})}>Fechar todos os acessos</Button>}
  <p className="locaccess-note">A proximidade usa o GPS do dispositivo e não é uma prova de presença. A revogação interrompe novas consultas e a localização é ocultada em até 20 segundos. Não apaga moradas já vistas ou cartões antigos já partilhados.</p>
 </section>;
}
