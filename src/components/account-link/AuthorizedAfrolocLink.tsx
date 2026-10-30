import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import AccountPhoneConfirmation from './AccountPhoneConfirmation';
type LinkRow={id:string;code:string;linked_at:string|null;revoked_at:string|null};
export default function AuthorizedAfrolocLink() {
 const [code,setCode]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[links,setLinks]=useState<LinkRow[]>([]),[request,setRequest]=useState<{request_id:string;authorization_url:string;account_reference:string}|null>(null);
 useEffect(()=>{if(import.meta.env.VITE_ACCOUNT_LINK_V1_ENABLED!=='true')return;const {data}=supabase.auth.onAuthStateChange(()=>{setConsent(false);setRequest(null);setLinks([]);setMessage('');});return()=>data.subscription.unsubscribe();},[]);
 const run=async(action:string,id?:string)=>{
  setBusy(true);setMessage('');
  try {
   if(action==='load') {
    const {data:u,error:ue}=await supabase.auth.getUser();if(ue||!u.user)throw new Error();
    const {data:p,error:pe}=await supabase.from('profiles').select('afroloc_code').eq('id',u.user.id).single();if(pe)throw new Error();setCode(p.afroloc_code??'');setConsent(false);
    const {data,error}=await supabase.functions.invoke('account-link',{body:{action:'list'}});if(error||!data?.ok)throw new Error();setLinks(data.links);return;
   }
   const {data,error}=await supabase.functions.invoke('account-link',{body:{action,id,code,consent}});
   if(error||!data?.ok){setMessage(data?.reason==='phone_required'?'Confirma primeiro o telefone nesta conta.':data?.reason==='address_changed'?'O endereço mudou. Atualiza os dados e autoriza novamente.':'Ligação ou certificado indisponível. Nenhuma certificação foi atribuída.');return;}
   if(action==='begin'){setRequest(data);setMessage('Abre o AFROLOC, entra na tua conta e confirma o destinatário e o endereço.');}
   else if(action==='revoke'){setLinks(v=>v.map(l=>l.id===id?{...l,revoked_at:new Date().toISOString()}:l));setMessage('Ligação revogada.');}
   else if(data.certified===true){
    if(action==='exchange'){
     setLinks(v=>[{id:id!,code,linked_at:new Date().toISOString(),revoked_at:null},...v.filter(l=>l.id!==id)]);
     setRequest(null);setConsent(false);
    }
    setMessage(`Certificado válido na consulta efetuada agora, até ${new Date(data.expires_at).toLocaleString()}. Não é uma garantia permanente.`);
   }
  }catch{setMessage('Serviço indisponível. Nenhuma certificação foi atribuída.');}finally{setBusy(false);}
 };
 if(import.meta.env.VITE_ACCOUNT_LINK_V1_ENABLED!=='true')return null;
 return <section className="space-y-4"><AccountPhoneConfirmation/><div className="rounded-xl border p-4 space-y-3"><h2 className="font-semibold">Ligar a minha conta AFROLOC</h2>
  <p className="text-sm">As contas continuam independentes. A ligação autoriza apenas a consulta do certificado deste endereço; podes revogá-la.</p>
  <Button variant="outline" disabled={busy} onClick={()=>void run('load')}>Carregar endereço e ligações</Button>
  <p className="font-mono text-sm break-all">{code||'Declara um endereço no perfil antes de ligar as contas.'}</p>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} disabled={busy||!code} onChange={e=>setConsent(e.target.checked)}/>Autorizo a Yamilook/KOSOLOLA a pedir ao AFROLOC a verificação deste endereço.</label>
  <Button disabled={busy||!code||!consent} onClick={()=>void run('begin')}>Pedir ligação</Button>
  {request&&<div className="space-y-2"><p className="text-sm">Confere no AFROLOC a referência desta conta: <strong>{request.account_reference}</strong>. Só aproves se começaste este pedido.</p>
   <Button asChild><a href={request.authorization_url} target="_blank" rel="noopener noreferrer">Autorizar no AFROLOC</a></Button>
   <Button variant="outline" disabled={busy} onClick={()=>void run('exchange',request.request_id)}>Concluir após autorizar</Button></div>}
  {links.map(l=><div key={l.id} className="border-t pt-2 text-sm"><p className="break-all">{l.code} — {l.revoked_at?'Revogada':l.linked_at?'Ligada':'Pendente'}</p>{!l.revoked_at&&<div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={()=>void run(l.linked_at?'status':'exchange',l.id)}>Verificar agora</Button><Button variant="outline" disabled={busy} onClick={()=>void run('revoke',l.id)}>Revogar</Button></div>}</div>)}
  <p role="status" className="text-sm">{message}</p></div></section>;
}
