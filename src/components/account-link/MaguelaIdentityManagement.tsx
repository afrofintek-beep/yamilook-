import {useEffect,useRef,useState} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {uiText as t,useUiLocale} from '@/i18n/ui-copy';

export default function MaguelaIdentityManagement(){
 useUiLocale();
 const [linked,setLinked]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[notice,setNotice]=useState<'revoked'|'unknown'|null>(null);
 const generation=useRef(0),lock=useRef(false);
 const enabled=import.meta.env.VITE_MAGUELA_IDENTITY_MANAGEMENT_ENABLED==='true';
 useEffect(()=>{
  if(!enabled)return;
  const {data}=supabase.auth.onAuthStateChange(()=>{generation.current++;lock.current=false;setLinked(null);setBusy(false);setConfirm(false);setNotice(null);});
  return()=>{generation.current++;data.subscription.unsubscribe();};
 },[enabled]);
 async function run(action:'status'|'revoke'){
  if(!enabled||lock.current||(action==='revoke'&&!confirm))return;
  const id=++generation.current;lock.current=true;setBusy(true);setConfirm(false);setLinked(null);setNotice(null);
  try{
   const {data:sessionData,error:sessionError}=await supabase.auth.getSession();
   if(sessionError||!sessionData.session||id!==generation.current)throw Error();
   const {data,error}=await supabase.functions.invoke('maguela-identity-bridge',{headers:{Authorization:'Bearer '+sessionData.session.access_token},body:action==='revoke'?{action,consent:true}:{action}});
   if(id!==generation.current)return;
   if(error||data?.ok!==true)throw Error();
   if(action==='revoke'){if(data.revoked!==true)throw Error();setLinked(false);setNotice('revoked');}
   else{if(typeof data.linked!=='boolean')throw Error();setLinked(data.linked);}
  }catch{if(id===generation.current)setNotice('unknown');}
  finally{if(id===generation.current){lock.current=false;setBusy(false);}}
 }
 if(!enabled)return null;
 return <section className="rounded-xl border p-4 space-y-3" aria-busy={busy}>
  <h2 className="font-semibold">{t('Contas associadas MAGUELA')}</h2>
  <p className="text-sm">{t('A associação não concede acesso a moradas privadas ou carteiras.')}</p>
  {linked!==null&&<p role="status">{linked?t('Associação activa'):t('Nenhuma associação activa confirmada')}</p>}
  <Button variant="outline" disabled={busy||confirm} onClick={()=>void run('status')}>{t('Consultar associação MAGUELA')}</Button>
  {confirm?<div className="space-y-2"><p className="text-sm">{t('Confirma a revogação da associação e dos códigos pendentes?')}</p><Button variant="destructive" disabled={busy} onClick={()=>void run('revoke')}>{t('Revogar associação MAGUELA')}</Button> <Button variant="outline" disabled={busy} onClick={()=>setConfirm(false)}>{t('Cancelar revogação')}</Button></div>:<Button variant="outline" disabled={busy} onClick={()=>setConfirm(true)}>{t('Revogar associação MAGUELA')}</Button>}
  {notice&&<p role="status" className="text-sm">{notice==='revoked'?t('Revogação confirmada pela MAGUELA.'):t('Não foi possível confirmar o estado. Tenta novamente.')}</p>}
 </section>;
}
