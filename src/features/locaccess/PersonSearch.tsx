import {useEffect,useId,useState} from 'react';
import {locaccess,validHandle} from './api';
export type AccessPerson={id:string;username:string;display_name:string|null;avatar_url?:string|null};
export function PersonSearch({query,selected,onQuery,onSelect,disabled=false}:{query:string;selected:AccessPerson|null;onQuery:(query:string)=>void;onSelect:(person:AccessPerson)=>void;disabled?:boolean}){
 const id=useId(),term=query.trim().replace(/^@+/,'');
 const [snapshot,setSnapshot]=useState<{term:string;people:AccessPerson[];error:boolean}|null>(null),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(selected||term.length<2||term.length>64)return;
  let active=true;
  const timer=setTimeout(()=>{void locaccess<AccessPerson[]>('search',{query:term}).then(people=>{
   if(!Array.isArray(people))throw new Error('invalid result');
   if(active)setSnapshot({term,people:people.filter(p=>validHandle(p.id)&&typeof p.username==='string'&&p.username.length>0),error:false});
  }).catch(()=>{if(active)setSnapshot({term,people:[],error:true})});},250);
  return()=>{active=false;clearTimeout(timer)};
 },[term,selected,retry]);
 const current=snapshot?.term===term?snapshot:null;
 return <div className="space-y-2">
  <label htmlFor={id} className="block text-sm">Pesquisar por nome ou @utilizador</label>
  <input id={id} type="search" className="w-full rounded-lg border bg-background p-3 text-base" maxLength={64} value={query} disabled={disabled} onChange={e=>onQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}} placeholder="Escreve pelo menos 2 letras" autoCapitalize="none" autoComplete="off" spellCheck={false} aria-describedby={id+'-status'}/>
  <div id={id+'-status'} role="status" className="text-sm text-muted-foreground">
   {selected?<>Seleccionado: <strong className="text-foreground">{selected.display_name||selected.username}</strong> · @{selected.username}</>:term.length<2?'Pesquisa pelo nome ou por parte do @utilizador.':!current?'A procurar pessoas…':current.error?'Não foi possível pesquisar. Verifica a ligação.':current.people.length?'Toca na pessoa certa para a seleccionar.':'Nenhuma pessoa encontrada. Tenta outra parte do nome ou do @utilizador.'}
  </div>
  {!selected&&current?.error&&<button type="button" className="min-h-11 underline" disabled={disabled} onClick={()=>{setSnapshot(null);setRetry(n=>n+1)}}>Tentar novamente</button>}
  {!selected&&current&&!current.error&&current.people.length>0&&<ul aria-label="Pessoas encontradas" className="max-h-64 overflow-y-auto rounded-lg border divide-y">
   {current.people.map(p=><li key={p.id}><button type="button" className="flex min-h-16 w-full items-center gap-3 p-3 text-start hover:bg-secondary focus-visible:bg-secondary" disabled={disabled} onClick={()=>onSelect(p)}>
    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary font-semibold">{(p.display_name||p.username).slice(0,1).toUpperCase()}</span>
    <span className="min-w-0"><strong className="block break-words">{p.display_name||p.username}</strong><span className="block break-all text-sm text-muted-foreground">@{p.username}</span></span>
   </button></li>)}
  </ul>}
  <p className="text-xs text-muted-foreground">Pesquisar e seleccionar não concede acesso. Confirma no botão abaixo.</p>
 </div>;
}
