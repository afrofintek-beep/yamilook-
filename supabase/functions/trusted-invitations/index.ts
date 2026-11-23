import { createClient } from 'npm:@supabase/supabase-js@2.90.1';
import { hash } from 'npm:bcryptjs@3.0.3';
import { createHandler, type Result } from './handler.ts';

const env = (key: string) => Deno.env.get(key) || '';
const url = env('SUPABASE_URL'), secret = env('SUPABASE_SERVICE_ROLE_KEY'), publicKey = env('SUPABASE_ANON_KEY');
const timeoutFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) });
const clientOptions = { auth:{persistSession:false,autoRefreshToken:false}, global:{fetch:timeoutFetch} };
const admin = createClient(url,secret,clientOptions);
const smsBase = env('INFOBIP_BASE_URL'), smsKey = env('INFOBIP_API_KEY'), smsSender = env('INFOBIP_SENDER');
const otpPepper = env('ACCOUNT_PHONE_OTP_PEPPER');
let smsOrigin = '';
try {
  const parsed = new URL(smsBase);
  if (parsed.protocol==='https:' && parsed.hostname.endsWith('.api.infobip.com') && !parsed.username && !parsed.password) smsOrigin=parsed.origin;
} catch { /* SMS remains unavailable until valid provider settings exist. */ }
const smsReady = env('TRUSTED_INVITATIONS_SMS_ENABLED')!=='false' && !!smsOrigin && !!smsKey && !!smsSender && otpPepper.length>=32;

Deno.serve(createHandler({
  smsReady, otpPepper, ratePepper:secret,
  async rpc(action,input,actor=null) {
    const {data,error}=await admin.rpc('trusted_invitations_service',{p_action:action,p_actor:actor,p_input:input});
    if(error || !data) throw new Error('unavailable');
    return data as Result;
  },
  async getUser(jwt) {
    const {data,error}=await admin.auth.getUser(jwt);
    return error ? null : data.user;
  },
  async createUser(attributes) {
    const {data,error}=await admin.auth.admin.createUser(attributes);
    return error || !data.user ? null : {id:data.user.id};
  },
  async signIn(identifier,password) {
    // A fresh client per request prevents sessions from crossing users.
    const auth=createClient(url,publicKey,clientOptions);
    const {data,error}=await auth.auth.signInWithPassword({email:identifier,password});
    return error ? null : data.session;
  },
  hashPassword: password => hash(password,10),
  async sendSms(phone,otp,language) {
    if(!smsReady) return false;
    const messages: Record<string,string> = {
      pt:`Código do convite Yamilook: ${otp}. Válido por 5 minutos. Não partilhe este código.`,
      en:`Yamilook invitation code: ${otp}. Valid for 5 minutes. Do not share this code.`,
      fr:`Code d'invitation Yamilook : ${otp}. Valable 5 minutes. Ne partagez pas ce code.`,
    };
    const res=await fetch(`${smsOrigin}/sms/2/text/advanced`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{Authorization:`App ${smsKey}`,'Content-Type':'application/json'},
      body:JSON.stringify({messages:[{from:smsSender,destinations:[{to:phone.slice(1)}],
        text:messages[language]||messages.en}]})});
    const body=await res.json().catch(()=>null);
    return res.ok && ['PENDING','DELIVERED'].includes(body?.messages?.[0]?.status?.groupName);
  },
}));
