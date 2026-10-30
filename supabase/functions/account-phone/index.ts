import {actor,admin,body,failure,json,preflight,rpc,uuid} from '../_shared/account-link.ts';
async function digest(user:string,id:string,otp:string) {
 const pepper=Deno.env.get('ACCOUNT_PHONE_OTP_PEPPER');if(!pepper || pepper.length<32)throw new Error('unavailable');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pepper),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`phone-v1:${user}:${id}:${otp}`)))).map(x=>x.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 try {
  const user=await actor(req);if(Deno.env.get('ACCOUNT_LINK_V1_ENABLED')!=='true')return json({ok:false,reason:'integration_pending'},503);
  const input=await body(req);const db=admin();
  if(['status','revoke'].includes(input.action))return json(await rpc(db,'account_phone_action',{p_actor:user,p_action:input.action}));
  if(input.action==='verify') {
   if(!uuid(input.challenge_id)||typeof input.otp!=='string'||!/^\d{6}$/.test(input.otp))return json({ok:false,reason:'invalid_challenge'},400);
   return json(await rpc(db,'account_phone_action',{p_actor:user,p_action:'verify',p_id:input.challenge_id,p_digest:await digest(user,input.challenge_id,input.otp)}));
  }
  if(input.action!=='begin'||input.consent!==true||typeof input.phone!=='string'||!/^\+[1-9]\d{7,14}$/.test(input.phone))return json({ok:false,reason:'consent_or_phone_required'},400);
  const base=Deno.env.get('INFOBIP_BASE_URL'),key=Deno.env.get('INFOBIP_API_KEY'),sender=Deno.env.get('INFOBIP_SENDER');
  if(!base||!key||!sender)throw new Error('unavailable');
  const url=new URL(base);if(url.protocol!=='https:'||!url.hostname.endsWith('.api.infobip.com')||url.username||url.password)throw new Error('unavailable');
  let n:number;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294000000);
  const otp=(n%1000000).toString().padStart(6,'0'),id=crypto.randomUUID();
  const result=await rpc(db,'account_phone_action',{p_actor:user,p_action:'begin',p_id:id,p_phone:input.phone,p_digest:await digest(user,id,otp)});
  if(!result.ok)return json(result);
  try {
   const res=await fetch(`${url.origin}/sms/2/text/advanced`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Authorization:`App ${key}`,'Content-Type':'application/json'},body:JSON.stringify({messages:[{from:sender,destinations:[{to:input.phone.slice(1)}],text:`Código para confirmar o telefone: ${otp}. Válido por 5 minutos. Não partilhe este código.`}]})});
   const data=await res.json();const group=data?.messages?.[0]?.status?.groupName;
   if(!res.ok||!['PENDING','DELIVERED'].includes(group))throw new Error('unavailable');
   await rpc(db,'account_phone_action',{p_actor:user,p_action:'delivered',p_id:id});
   return json({ok:true,challenge_id:id});
  }catch{
   await rpc(db,'account_phone_action',{p_actor:user,p_action:'cancel',p_id:id});throw new Error('unavailable');
  }
 }catch(error){return failure(error);}
});
