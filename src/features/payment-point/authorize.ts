import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { supabase } from '@/integrations/supabase/client';

type Operation = {action: string; id: string; amount: number; destination: string; currency: 'AOA'};

export class WalletSessionVerificationRequired extends Error {}

async function begin(purpose: string, operation: Operation | null) {
  const {data,error} = await supabase.rpc('wallet_begin' as never,{p_purpose:purpose,p_operation:operation} as never);
  if (purpose === 'register' && error?.message.includes('confirme a sessão com o segundo factor')) {
    throw new WalletSessionVerificationRequired(error.message);
  }
  if (error) throw new Error(error.message);
  return data as {challenge:string; credentials:string[]};
}
async function verify(challenge:string, response:unknown) {
  const {data,error} = await supabase.functions.invoke('wallet-verify',{body:{challenge,response}});
  if (error || !data?.verified) throw new Error('Não foi possível confirmar a chave da carteira.');
}
export async function authorizeDebit(operation: Operation) {
  let state = await begin('authorize',operation);
  if (!state.credentials.length) {
    const {data} = await supabase.auth.getUser();
    if (!data.user) throw new Error('Entre novamente na carteira.');
    const registration = await begin('register',null);
    const response = await startRegistration({optionsJSON:{
      challenge:registration.challenge, rp:{id:'yamilook.com',name:'Carteira Yamilook'},
      user:{id:btoa(data.user.id),name:data.user.email || data.user.id,displayName:'Titular da carteira'},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      authenticatorSelection:{userVerification:'required'},timeout:90000,attestation:'none'
    }});
    await verify(registration.challenge,response);
    state = await begin('authorize',operation);
  }
  const response = await startAuthentication({optionsJSON:{challenge:state.challenge,rpId:'yamilook.com',
    allowCredentials:state.credentials.map(id=>({id,type:'public-key'})),userVerification:'required',timeout:90000}});
  await verify(state.challenge,response);
}
