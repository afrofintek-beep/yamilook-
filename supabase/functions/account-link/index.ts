import {actor,admin,body,failure,hash,json,preflight,rpc,uuid} from '../_shared/account-link.ts';
import {validEvidence} from './evidence.ts';
async function partner(input:Record<string,unknown>) {
 const endpoint=Deno.env.get('AFROLOC_LINK_ENDPOINT'),key=Deno.env.get('ACCOUNT_LINK_PARTNER_KEY');
 if(!endpoint||!key||key.length<32)throw new Error('unavailable');
 const url=new URL(endpoint);if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/functions/v1/account-link-authority'||url.username||url.password||url.search||url.hash)throw new Error('unavailable');
 const res=await fetch(url,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/json','x-account-link-key':key},body:JSON.stringify(input)});
 if(!res.ok)throw new Error('unavailable');return await res.json();
}
Deno.serve(async req=>{
 const early=preflight(req);if(early)return early;
 try {
  const user=await actor(req);if(Deno.env.get('ACCOUNT_LINK_V1_ENABLED')!=='true')return json({ok:false,reason:'integration_pending'},503);
  const input=await body(req),db=admin();
  if(input.action==='list') {
   const {data,error}=await db.from('afroloc_link_requests').select('id,code,linked_at,revoked_at').eq('user_id',user).order('created_at',{ascending:false}).limit(10);
   if(error)throw new Error('unavailable');return json({ok:true,links:data});
  }
  if(input.action==='begin') {
   if(input.consent!==true)return json({ok:false,reason:'consent_required'},400);
   const phone=await rpc(db,'account_phone_action',{p_actor:user,p_action:'status'});if(!phone.verified)return json({ok:false,reason:'phone_required'});
   const {data:profile,error}=await db.from('profiles').select('afroloc_code').eq('id',user).single();
   if(error||!profile?.afroloc_code||input.code!==profile.afroloc_code)return json({ok:false,reason:'address_changed'});
   const verifier=crypto.randomUUID()+crypto.randomUUID();
   const remote=await partner({action:'begin',subject:user,code:profile.afroloc_code,verifier_hash:await hash(verifier)});
   if(!remote.ok)return json(remote);if(!uuid(remote.request_id))throw new Error('unavailable');
   const {error:saveError}=await db.from('afroloc_link_requests').insert({id:remote.request_id,user_id:user,code:profile.afroloc_code,verifier});
   if(saveError)throw new Error('unavailable');
   const consentUrl=new URL(Deno.env.get('AFROLOC_CONSENT_URL')??'https://www.afroloc.ao/account-link');
   if(consentUrl.protocol!=='https:'||consentUrl.username||consentUrl.password||consentUrl.search||consentUrl.hash||consentUrl.pathname!=='/account-link')throw new Error('unavailable');
   consentUrl.hash=`request=${remote.request_id}`;
   return json({ok:true,request_id:remote.request_id,account_reference:user.slice(-8),authorization_url:consentUrl.href});
  }
  if(!['exchange','status','revoke'].includes(input.action)||!uuid(input.id))return json({ok:false,reason:'invalid_request'},400);
  const {data:link,error}=await db.from('afroloc_link_requests').select('*').eq('id',input.id).eq('user_id',user).single();
  if(error||!link)return json({ok:false,reason:'unavailable'});
  if(input.action==='revoke') {
   // Local disable first: partner outage must never leave local usage enabled.
   const {error:e}=await db.from('afroloc_link_requests').update({revoked_at:new Date().toISOString(),verifier:null}).eq('id',link.id).eq('user_id',user);if(e)throw new Error('unavailable');
   const remote=await partner({action:'revoke_partner',subject:user,id:link.id});return json(remote.ok?{ok:true}:{ok:false,reason:'remote_revocation_pending'});
  }
  if(link.revoked_at)return json({ok:false,certified:false,reason:'revoked'});
  const phone=await rpc(db,'account_phone_action',{p_actor:user,p_action:'status'});if(!phone.verified)return json({ok:false,certified:false,reason:'phone_required'});
  const {data:profile,error:e}=await db.from('profiles').select('afroloc_code').eq('id',user).single();
  if(e||profile?.afroloc_code!==link.code)return json({ok:false,certified:false,reason:'address_changed'});
  // After an ambiguous exchange timeout, status recovers an already consumed grant.
  let remote=await partner({action:'status',subject:user,id:link.id});
  if(!remote.ok&&input.action==='exchange'&&link.verifier)remote=await partner({action:'exchange',subject:user,id:link.id,verifier_hash:await hash(link.verifier)});
  if(!validEvidence(remote,{subject:user,code:link.code,linkId:link.id},Date.now()))return json({ok:false,certified:false,reason:'not_current'});
  const {data:current,error:ce}=await db.from('profiles').select('afroloc_code').eq('id',user).single();
  const {data:latest,error:le}=await db.from('afroloc_link_requests').select('revoked_at').eq('id',link.id).eq('user_id',user).single();
  const finalPhone=await rpc(db,'account_phone_action',{p_actor:user,p_action:'status'});
  if(!finalPhone.verified||ce||le||!latest||latest.revoked_at||current?.afroloc_code!==link.code)return json({ok:false,certified:false,reason:'state_changed'});
  if(input.action==='exchange') {const {error:se}=await db.from('afroloc_link_requests').update({linked_at:new Date().toISOString(),verifier:null}).eq('id',link.id).eq('user_id',user).is('revoked_at',null);if(se)throw new Error('unavailable');}
  // Database reads can outlive the evidence window; recheck time at point of return.
  if(!validEvidence(remote,{subject:user,code:link.code,linkId:link.id},Date.now()))return json({ok:false,certified:false,reason:'not_current'});
  // Observation only. Never write profiles.certified or authorize financial actions.
  return json(remote);
 }catch(error){return failure(error);}
});
