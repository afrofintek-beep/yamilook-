import {createClient} from "npm:@supabase/supabase-js@2.90.1";
import {actor,admin,rpc} from "../_shared/account-link.ts";
import {createBridge} from "./handler.ts";
const api="https://api.maguela.com/v1/";
const endpoint=api+"identity-link/";
function sessionClient(req:Request){
 const authorization=req.headers.get("Authorization")??"";
 return createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
}
async function liveSession(req:Request,_subject:string){
 const client=sessionClient(req);
 const {data,error}=await client.rpc("account_current_session_id");
 return !error&&typeof data==="string"&&data.length>0;
}
async function callPartner(path:"redeem"|"partner/status"|"partner/revoke",body:Record<string,unknown>){
 const key=Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")!;
 const res=await fetch(endpoint+path,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5000),headers:{"content-type":"application/json","x-maguela-identity-key":key},body:JSON.stringify(body)});
 return res.ok?await res.json():null;
}
Deno.serve(createBridge({
 enabled:()=>Deno.env.get("MAGUELA_IDENTITY_BRIDGE_V2_ENABLED")==="true"&&Deno.env.get("MAGUELA_IDENTITY_BRIDGE_ENABLED")==="true"&&(Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")??"").length>=32,
 managementEnabled:()=>Deno.env.get("MAGUELA_IDENTITY_MANAGEMENT_ENABLED")==="true"&&(Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")??"").length>=32,
 loginEnabled:()=>Deno.env.get("MAGUELA_ECOSYSTEM_LOGIN_ENABLED")==="true"&&(Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")??"").length>=32,
 async authorizeLogin(req,subject,origin,challenge){
  if(!await liveSession(req,subject))return null;
  const client=sessionClient(req);
  const {data,error}=await client.rpc("integration_access_manage",{p_action:"status",p_user_id:null,p_feature:null});
  if(error||data?.userId!==subject||data?.maguela!==true)return null;
  const response=await fetch(api+"auth/ecosystem/grant",{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5000),headers:{"content-type":"application/json","x-maguela-identity-key":Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")!},body:JSON.stringify({subject,origin,challenge})});
  if(!response.ok)return null;
  const grant=await response.json();
  return typeof grant?.code==="string"?grant.code:null;
 },
 authenticate:actor,
 liveSession,
 async status(subject){const data=await callPartner("partner/status",{subject});return typeof data?.linked==="boolean"?{linked:data.linked}:null;},
 async revoke(subject){const data=await callPartner("partner/revoke",{subject,consent:true});return data?.revoked===true?{revoked:true as const}:null;},
 async eligible(req,subject){
  if(!await liveSession(req,subject))return false;
  const db=admin();
  const {data:profile,error}=await db.from("profiles").select("account_status").eq("id",subject).single();
  if(error||profile?.account_status!=="active")return false;
  const phone=await rpc(db,"account_phone_action",{p_actor:subject,p_action:"status"});
  return phone?.verified===true;
 },
 async redeem(challenge,subject){
  const data=await callPartner("redeem",{challenge,subject});
  if(data?.linked!==false||data.pending!==true||typeof data.confirmation!=="string"||!/^[a-f0-9]{64}$/.test(data.confirmation))return null;
  return {linked:false as const,pending:true as const,confirmation:data.confirmation};
 }
}));
