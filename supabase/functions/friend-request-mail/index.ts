import { createClient } from 'npm:@supabase/supabase-js@2.90.1';
import { friendRequestEmail } from './copy.ts';

Deno.serve(async (req: Request) => {
 const reply = (status: number, value: unknown) => Response.json(value, {status});
 if (req.method !== 'POST') return reply(405, {error:'method'});
 const token = req.headers.get('x-friend-mail-token');
 if (!token || token.length > 256) return reply(401, {error:'unauthorized'});
 const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
 try {
  // Only the database scheduler knows this token. End users cannot invoke the worker.
  const authorized = await admin.rpc('friend_mail_authorized', {p_token:token});
  if (authorized.error || authorized.data !== true) return reply(401, {error:'unauthorized'});
  const key = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('YAMILOOK_INVITE_EMAIL_FROM');
  if (!key || !from || /[\r\n]/.test(from)) return reply(503, {error:'email_not_configured'});
  // Authenticated configuration probe never claims or sends messages.
  const body = await req.json().catch(()=>({}));
  if (body.check === true) return reply(200, {configured:true});
  const batch = await admin.rpc('claim_friend_mail');
  if (batch.error) return reply(503, {error:'queue_unavailable'});
  let sent=0, retry=0;
  for (const row of batch.data || []) {
   let state='pending', providerId: string|null=null, error: string|null=null;
   try {
    const mail=friendRequestEmail(row.request_id,row.payload.name,row.payload.language);
    const response=await fetch('https://api.resend.com/emails', {
     method:'POST',signal:AbortSignal.timeout(8000),
     headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json','Idempotency-Key':`yamilook-friend-${row.request_id}`},
     body:JSON.stringify({from,to:[row.payload.email],...mail}),
    });
    const result=await response.json().catch(()=>({}));
    if(response.ok && typeof result.id==='string') {state='sent';providerId=result.id;sent++;}
    else {error=`provider_${response.status}`; if(response.status>=400 && response.status<500 && ![408,409,429].includes(response.status)) state='failed';}
   } catch { error='provider_unavailable'; }
   if(state==='pending') retry++;
   const finish=await admin.rpc('finish_friend_mail',{p_request_id:row.request_id,p_attempt:row.attempts,p_state:state,p_provider_id:providerId,p_error:error});
   if(finish.error) console.error('friend_mail_finalize_failed');
   // The provider's default account limit is shared with other transactional mail.
   await new Promise(resolve=>setTimeout(resolve,600));
  }
  return reply(200,{sent,retry});
 } catch {return reply(503,{error:'unavailable'});}
});
