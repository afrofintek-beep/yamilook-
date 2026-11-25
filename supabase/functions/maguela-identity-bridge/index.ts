import {createClient} from "npm:@supabase/supabase-js@2.90.1";
import {actor,admin,rpc} from "../_shared/account-link.ts";
import {createBridge} from "./handler.ts";
const endpoint="https://api.maguela.com/v1/identity-link/redeem";
Deno.serve(createBridge({
 enabled:()=>Deno.env.get("MAGUELA_IDENTITY_BRIDGE_V2_ENABLED")==="true"&&Deno.env.get("MAGUELA_IDENTITY_BRIDGE_ENABLED")==="true"&&(Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")??"").length>=32,
 authenticate:actor,
 async eligible(req,subject){
  const auth=req.headers.get("Authorization")??"";
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:session,error:sessionError}=await client.rpc("account_current_session_id");
  if(sessionError||typeof session!=="string"||!session)return false;
  const db=admin();
  const {data:profile,error}=await db.from("profiles").select("account_status").eq("id",subject).single();
  if(error||profile?.account_status!=="active")return false;
  const phone=await rpc(db,"account_phone_action",{p_actor:subject,p_action:"status"});
  return phone?.verified===true;
 },
 async redeem(challenge,subject){
  const key=Deno.env.get("MAGUELA_IDENTITY_PARTNER_KEY")!;
  const res=await fetch(endpoint,{method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(5000),headers:{"content-type":"application/json","x-maguela-identity-key":key},body:JSON.stringify({challenge,subject})});
  if(!res.ok)return null;
  const data=await res.json();
  if(data?.linked!==false||data.pending!==true||typeof data.confirmation!=="string"||!/^[a-f0-9]{64}$/.test(data.confirmation))return null;
  return {linked:false as const,pending:true as const,confirmation:data.confirmation};
 }
}));
