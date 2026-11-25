import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {maguelaPickup,validPickupReference} from './maguela-pickup';
import {uiText as t} from '@/i18n/ui-copy';

/** Owner explicitly designates a public landmark for a single existing recipient. */
export function MaguelaPickupControl({handle,grantId,disabled}:{handle:string;grantId:string;disabled:boolean}){
 const [reference,setReference]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[designated,setDesignated]=useState(false);
 const seq=useRef(0),lock=useRef(false);
 useEffect(()=>{const id=++seq.current;setReference('');setDesignated(false);setMessage('');
  void maguelaPickup('owner_status',{handle,grant_id:grantId}).then(r=>{if(seq.current===id&&r.status==='designated'&&r.reference){setReference(r.reference);setDesignated(true)}}).catch(()=>{});
  return()=>{seq.current++;};
 },[handle,grantId]);
 const change=async(action:'set'|'clear')=>{
  if(lock.current||disabled||(action==='set'&&!validPickupReference(reference.trim())))return;
  lock.current=true;setBusy(true);setMessage('');const id=++seq.current;
  try{
   const result=await maguelaPickup(action,{handle,grant_id:grantId,...(action==='set'?{reference:reference.trim()}:{})});
   if(seq.current!==id)return;
   if(result.status==='designated'){setDesignated(true);setMessage('Ponto de recolha indicado. A MAGUELA terá de validar a referência pública.');}
   else if(result.status==='cleared'){setDesignated(false);setReference('');setMessage('Autorização de recolha retirada.');}
   else setMessage('Não foi possível autorizar este ponto de recolha.');
  }catch{if(seq.current===id)setMessage('Não foi possível guardar a autorização.');}
  finally{lock.current=false;if(seq.current===id)setBusy(false);}
 };
 return <details className="w-full rounded-lg border p-3">
  <summary className="cursor-pointer font-medium">{t('Ponto de recolha MAGUELA')}</summary>
  <p className="my-2 text-sm">{t('Opcional. Autoriza este destinatário a consultar uma referência AFROLOC pública, como a portaria. Não introduzas a morada privada.')}</p>
  <input aria-label={t('Referência pública AFROLOC de recolha')} className="min-h-11 w-full rounded-md border bg-background px-3" maxLength={128} autoComplete="off" value={reference} disabled={busy||disabled} onChange={e=>setReference(e.target.value)}/>
  <div className="mt-2 flex flex-wrap gap-2">
   <Button type="button" variant="outline" disabled={busy||disabled||!validPickupReference(reference.trim())} onClick={()=>void change('set')}>{t('Autorizar recolha MAGUELA')}</Button>
   {designated&&<Button type="button" variant="outline" disabled={busy||disabled} onClick={()=>void change('clear')}>{t('Retirar autorização MAGUELA')}</Button>}
  </div>
  {message&&<p role="status" className="text-sm">{t(message)}</p>}
 </details>;
}

/** No cross-origin token, URL parameter, private coordinate or persistent browser storage. */
export function MaguelaPickupVisit({handle}:{handle:string}){
 const [reference,setReference]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const sequence=useRef(0),deadline=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|undefined>();
 const clear=()=>{sequence.current++;deadline.current=0;clearTimeout(timer.current);setReference('');setBusy(false);};
 useEffect(()=>{
  const hide=()=>{if(document.hidden)clear();};
  window.addEventListener('offline',clear);window.addEventListener('pagehide',clear);document.addEventListener('visibilitychange',hide);
  return()=>{sequence.current++;clearTimeout(timer.current);window.removeEventListener('offline',clear);window.removeEventListener('pagehide',clear);document.removeEventListener('visibilitychange',hide)};
 },[handle]);
 const resolve=async()=>{
  if(busy||document.hidden||!navigator.onLine)return;
  clear();setBusy(true);setMessage('');const id=++sequence.current,started=performance.now(),wall=Date.now();
  try{
   const result=await maguelaPickup('resolve',{handle});
   if(sequence.current!==id||document.hidden||!navigator.onLine)return;
   const expiry=Date.parse(result.expiresAt||''),end=Math.min(started+20000,started+expiry-wall,performance.now()+expiry-Date.now());
   if(result.status!=='ready'||!result.reference||!validPickupReference(result.reference)||!Number.isFinite(end)||end<=performance.now()||expiry>wall+25000){setMessage('Não existe uma autorização de recolha disponível.');return;}
   deadline.current=end;setReference(result.reference);timer.current=setTimeout(clear,end-performance.now());
  }catch{if(sequence.current===id)setMessage('Não foi possível consultar a autorização.');}
  finally{if(sequence.current===id)setBusy(false);}
 };
 const copy=async()=>{if(!reference||performance.now()>=deadline.current||document.hidden||!navigator.onLine){clear();return;}try{await navigator.clipboard.writeText(reference);setMessage('Referência copiada. Confirma-a na MAGUELA antes de pedir transporte.');}catch{setMessage('Selecciona e copia a referência manualmente.');}};
 return <section className="rounded-lg border p-3 space-y-2">
  <h2 className="font-medium">{t('Recolha MAGUELA')}</h2>
  <p className="text-sm">{t('Consulta apenas o ponto público indicado pelo titular. A morada privada não é enviada.')}</p>
  <Button type="button" variant="outline" disabled={busy} onClick={()=>void resolve()}>{t('Consultar ponto de recolha')}</Button>
  {reference&&<div><p dir="ltr" className="break-all font-medium">{reference}</p><Button type="button" variant="outline" onClick={()=>void copy()}>{t('Copiar referência')}</Button> <a href="https://maguela.com" target="_blank" rel="noopener noreferrer" className="underline">{t('Abrir MAGUELA')}</a></div>}
  {message&&<p role="status" className="text-sm">{t(message)}</p>}
 </section>;
}
