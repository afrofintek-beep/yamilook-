import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export default function AccountPhoneConfirmation() {
 const [phone,setPhone]=useState(''),[otp,setOtp]=useState(''),[consent,setConsent]=useState(false),[challenge,setChallenge]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{const {data}=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'||event==='SIGNED_IN'){setChallenge(null);setOtp('');setPhone('');setConsent(false);setMessage('');}});return()=>data.subscription.unsubscribe();},[]);
 const run=async(action:string)=>{
  setBusy(true);setMessage('');
  try {
   const {data,error}=await supabase.functions.invoke('account-phone',{body:{action,phone,consent,challenge_id:challenge,otp}});
   if(error||!data?.ok){setMessage(data?.reason==='try_later'?'Aguarda antes de pedir outro código.':'Não foi possível confirmar. Verifica o código ou tenta mais tarde.');return;}
   if(action==='begin'){setChallenge(data.challenge_id);setOtp('');setMessage('Código enviado. Expira em cinco minutos.');}
   else if(action==='verify'){setChallenge(null);setOtp('');setMessage('Telefone confirmado nesta conta. Isto não certifica o endereço.');}
   else if(action==='status')setMessage(data.verified?'Telefone confirmado nesta conta.':'Telefone ainda não confirmado ou confirmação expirada.');
   else {setChallenge(null);setMessage('Confirmação do telefone revogada.');}
  }catch{setMessage('Serviço indisponível. Tenta mais tarde.');}finally{setBusy(false);}
 };
 return <section className="rounded-xl border p-4 space-y-3"><h2 className="font-semibold">Confirmar telefone</h2>
  <p className="text-sm">A confirmação mantém a tua conta, mensagens e contactos. O número não é usado para juntar contas.</p>
  <label className="block text-sm">Número com indicativo internacional<Input type="tel" autoComplete="tel" value={phone} onChange={e=>{setPhone(e.target.value);setChallenge(null);setOtp('');setConsent(false);}} placeholder="+244…" disabled={busy}/></label>
  <label className="flex gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/>Autorizo o envio de um SMS para confirmar que controlo este número.</label>
  <Button disabled={busy||!consent||!/^\+[1-9]\d{7,14}$/.test(phone)} onClick={()=>void run('begin')}>Enviar código</Button>
  {challenge&&<><label className="block text-sm">Código SMS<Input inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)} maxLength={6} disabled={busy}/></label><Button disabled={busy||!/^\d{6}$/.test(otp)} onClick={()=>void run('verify')}>Confirmar código</Button></>}
  <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void run('status')}>Ver estado</Button><Button variant="outline" disabled={busy} onClick={()=>void run('revoke')}>Revogar confirmação</Button></div>
  <p role="status" className="text-sm">{message}</p>
 </section>;
}
