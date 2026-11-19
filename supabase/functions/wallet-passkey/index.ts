import postgres from 'npm:postgres@3.4.5';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { generateRegistrationOptions, generateAuthenticationOptions } from 'npm:@simplewebauthn/server@13.2.2';
import { verifyWalletRegistration, verifyWalletUnlock } from '../_shared/wallet-passkeys.ts';

const db = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false, max: 1 });
const headers = { 'Access-Control-Allow-Origin': 'https://yamilook.com', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Cache-Control': 'no-store' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });
  try {
    const authorization = req.headers.get('Authorization') ?? '';
    const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return reply({}, 401);
    const { data: allowed } = await auth.rpc('has_wallet_access');
    if (allowed !== true) return reply({}, 403);
    const token = authorization.split(' ')[1];
    const { session_id: session, amr } = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if (!session) return reply({}, 401);
    const { action, challenge, response } = await req.json();
    const uid = user.id;
    const keys = await db`select * from wallet_security.credentials where holder_id=${uid} and revoked_at is null`;
    if (action === 'lock') {
      await db`delete from wallet_security.unlocks where holder_id=${uid} and session_id=${session}`;
      return reply({ locked: true });
    }
    if (action === 'status') {
      const active = await db`select 1 from wallet_security.unlocks where holder_id=${uid} and session_id=${session} and expires_at > now()`;
      return reply({ registered: keys.length > 0, unlocked: active.length > 0 });
    }
    const register = action === 'register-options' || action === 'register-finish';
    if (register && (keys.length || !amr?.some((a: {method:string,timestamp:number}) => ['password','otp','oauth','webauthn'].includes(a.method) && a.timestamp > Date.now()/1000-300))) {
      return reply({ error: 'Volta a iniciar sessão para activar a primeira chave.' },403);
    }
    const purpose = register ? 'register' : 'unlock';
    if (action === 'register-options' || action === 'unlock-options') {
      const options = register ? await generateRegistrationOptions({ rpName: 'CARTEIRA Yamilook', rpID: 'yamilook.com', userID: new TextEncoder().encode(uid), userName: user.email ?? uid, authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' } }) :
        await generateAuthenticationOptions({ rpID:'yamilook.com', userVerification:'required', allowCredentials:keys.map(k=>({id:k.credential_id})) });
      await db`insert into wallet_security.challenges(challenge,holder_id,session_id,purpose) values(${options.challenge},${uid},${session},${purpose})`;
      return reply(options);
    }
    if (!['register-finish','unlock-finish'].includes(action)) return reply({},400);
    await db.begin(async tx => {
      const [row] = await tx`select wallet_security.consume_challenge(${challenge},${uid},${session},${purpose},null) as valid`;
      if (!row.valid) throw Error();
      if (register) {
        const result = await verifyWalletRegistration(response,challenge);
        if (!result.verified || !result.registrationInfo) throw Error();
        const key = result.registrationInfo.credential;
        await tx`insert into wallet_security.credentials(credential_id,holder_id,public_key,sign_count) values(${key.id},${uid},${key.publicKey},${key.counter})`;
      } else {
        const [key] = await tx`select * from wallet_security.credentials where credential_id=${response.id} and holder_id=${uid} and revoked_at is null for update`;
        if (!key) throw Error();
        const result = await verifyWalletUnlock(response,challenge,{id:key.credential_id, publicKey:new Uint8Array(key.public_key), counter:Number(key.sign_count)});
        if (!result.verified) throw Error();
        await tx`update wallet_security.credentials set sign_count=${result.authenticationInfo.newCounter} where credential_id=${key.credential_id}`;
      }
      await tx`insert into wallet_security.unlocks(holder_id,session_id,expires_at) values(${uid},${session},now()+interval '5 minutes') on conflict(holder_id,session_id) do update set expires_at=excluded.expires_at`;
    });
    return reply({ unlocked:true });
  } catch { return reply({error:'Não foi possível confirmar a chave da carteira.'},400); }
});