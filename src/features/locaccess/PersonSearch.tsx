import {uiText as t,useUiLocale} from '@/i18n/ui-copy';
import {useEffect,useId,useState} from 'react';
import {locaccess,validHandle} from './api';
import {Check,Search} from 'lucide-react';
export type AccessPerson={id:string;username:string;display_name:string|null;avatar_url?:string|null};
export function PersonSearch({query,selected,onQuery,onSelect,disabled=false}:{query:string;selected:AccessPerson|null;onQuery:(query:string)=>void;onSelect:(person:AccessPerson)=>void;disabled?:boolean}){
 useUiLocale();
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
 const people=selected?(snapshot?.people.some(p=>p.id===selected.id)?snapshot.people:[selected]):current?.people||[];
 return <div className="locaccess-search">
  <label htmlFor={id} className="block text-sm">{t("Pesquisar por nome ou @utilizador")}</label>
  <div className="locaccess-search-field"><input id={id} type="search" className="locaccess-search-input" maxLength={64} value={query} disabled={disabled} onChange={e=>onQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault()}} placeholder={t("Escreve pelo menos 2 letras")} autoCapitalize="none" autoComplete="off" spellCheck={false} aria-describedby={id+'-status'}/><Search aria-hidden="true" size={20}/></div>
  {!selected&&current?.error&&<button type="button" className="min-h-11 underline" disabled={disabled} onClick={()=>{setSnapshot(null);setRetry(n=>n+1)}}>{t("Tentar novamente")}</button>}
  {people.length>0&&<ul aria-label={t("Pessoas encontradas")} className="locaccess-people">
   {people.map(p=><li key={p.id}><button type="button" aria-pressed={selected?.id===p.id} className="locaccess-person" disabled={disabled} onClick={()=>onSelect(p)}>
    <span aria-hidden="true" className="locaccess-avatar">{(p.display_name||p.username).slice(0,1).toUpperCase()}</span>
    <span className="min-w-0"><strong className="block break-words">{p.display_name||p.username}</strong><span className="block break-all text-sm text-muted-foreground">@{p.username}</span></span>
    {selected?.id===p.id&&<span className="locaccess-check"><Check aria-hidden="true" size={18}/></span>}
   </button></li>)}
  </ul>}
  <div id={id+'-status'} role="status" className="text-sm text-muted-foreground">
   {selected?<>{t("Pessoa seleccionada:")} <strong className="text-foreground">{selected.display_name||selected.username}</strong> · @{selected.username}</>:term.length<2?t('Pesquisa pelo nome ou por parte do @utilizador.'):!current?t('A procurar pessoas…'):current.error?t('Não foi possível pesquisar. Verifica a ligação.'):current.people.length?t('Toca na pessoa certa para a seleccionar.'):t('Nenhuma pessoa encontrada. Tenta outra parte do nome ou do @utilizador.')}
  </div>

 </div>;
}
