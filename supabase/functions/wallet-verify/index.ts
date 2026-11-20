import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyWalletRegistration, verifyWalletUnlock } from '../_shared/wallet-passkeys.ts';

const origins = ['https://yamilook.com', 'https://www.yamilook.com'];
Deno.serve(async request => {
  const origin = request.headers.get('Origin') || '';
  if (!origins.includes(origin)) return new Response(null, {status: 403});
  const headers = {'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json', 'Vary': 'Origin'};
  if (request.method === 'OPTIONS') return new Response(null, {headers});
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /i,'') || '';
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data, error} = await admin.auth.getUser(token);
    if (error || !data.user) throw Error();
    const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    const {challenge, response} = await request.json();
    const args = {p_holder:data.user.id,p_session:claims.session_id,p_challenge:challenge,p_id:response.id};
    const {data: state,error: readError} = await admin.rpc('wallet_verifier_read',args);
    if (readError || !state) throw Error();
    let key = null;
    let counter: number;
    if (state.purpose === 'register') {
      const check = await verifyWalletRegistration(response,challenge);
      if (!check.verified || !check.registrationInfo || check.registrationInfo.credential.id !== response.id) throw Error();
      key = btoa(String.fromCharCode(...check.registrationInfo.credential.publicKey));
      counter = check.registrationInfo.credential.counter;
    } else {
      if (state.purpose !== 'authorize' || !state.key) throw Error();
      const check = await verifyWalletUnlock(response,challenge,{id:response.id,publicKey:Uint8Array.from(atob(state.key), c=>c.charCodeAt(0)),counter:state.counter});
      if (!check.verified) throw Error();
      counter = check.authenticationInfo.newCounter;
    }
    const result = await admin.rpc('wallet_verifier_finish',{...args,p_operation:state.operation,p_purpose:state.purpose,p_key:key,p_counter:counter});
    if (result.error) throw Error();
    return Response.json({verified:true},{headers});
  } catch {
    return Response.json({error:'Não foi possível verificar esta autorização.'},{status:400,headers});
  }
});
