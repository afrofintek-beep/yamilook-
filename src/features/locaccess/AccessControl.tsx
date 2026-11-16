import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
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
 const [username,setUsername]=useState(''),[radius,setRadius]=useState('500'),[hours,setHours]=useState('24');
 const grants=control.policy?.grants||[];
 return <section className="rounded-xl border p-4 space-y-3" aria-label="LOCACCESS">
  <div className="flex flex-wrap justify-between gap-2"><strong>LOCACCESS · Experimental</strong><span className="text-sm">{grants.length?`${grants.length} acesso(s) autorizado(s)`:'Fechado a terceiros'}</span></div>
  <p className="text-sm text-muted-foreground">Só a conta Yamilook escolhida pode consultar a localização. Imediato significa acesso sem limite de distância para essa pessoa.</p>
  {control.error&&<p role="alert" className="text-sm">{control.error} <button className="underline" onClick={control.retry}>Tentar novamente</button></p>}
  {control.busy&&!control.policy&&<p role="status">A preparar o acesso protegido…</p>}
  <details><summary className="cursor-pointer font-medium">Escolher quem pode aceder</summary>
   <form className="mt-4 grid gap-4" onSubmit={e=>{e.preventDefault();void control.change('grant',{username:username.trim().replace(/^@/,''),radius:Number(radius),hours:Number(hours)}).then(()=>setUsername('')).catch(()=>{})}}>
    <label className="grid gap-1 text-sm">Nome de utilizador Yamilook<input className="rounded-lg border bg-background p-3" required maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} placeholder="@nome" autoCapitalize="none" autoComplete="off"/></label>
    <label className="grid gap-1 text-sm">Revelar a morada<select className="rounded-lg border bg-background p-3" value={radius} onChange={e=>setRadius(e.target.value)}><option value="100">A 100 metros</option><option value="250">A 250 metros</option><option value="500">A 500 metros</option><option value="0">Imediatamente — pessoa autorizada</option></select></label>
    <label className="grid gap-1 text-sm">Validade<select className="rounded-lg border bg-background p-3" value={hours} onChange={e=>setHours(e.target.value)}><option value="1">1 hora</option><option value="24">24 horas</option><option value="168">7 dias</option></select></label>
    <Button disabled={control.busy||!control.policy}>Autorizar esta pessoa</Button>
   </form>
  </details>
  {grants.map(g=><div key={g.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3"><div className="text-sm"><strong>@{g.username}</strong><p>{g.radius?`${g.radius} metros`:'Imediato'} · até {new Date(g.expiresAt).toLocaleString('pt-PT',{timeZone:'Africa/Luanda'})}</p></div><Button variant="outline" disabled={control.busy} onClick={()=>void control.change('revoke',{grant_id:g.id}).catch(()=>{})}>Fechar acesso</Button></div>)}
  {grants.length>0&&<Button variant="outline" className="w-full" disabled={control.busy} onClick={()=>void control.change('close').catch(()=>{})}>Fechar todos os acessos</Button>}
  <p className="text-xs text-muted-foreground">A proximidade usa o GPS do dispositivo e não é uma prova de presença. A revogação interrompe novas consultas e a localização é ocultada em até 20 segundos. Não apaga moradas já vistas ou cartões antigos já partilhados.</p>
 </section>;
}
