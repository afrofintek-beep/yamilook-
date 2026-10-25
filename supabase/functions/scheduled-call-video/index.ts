import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/index.ts';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
  const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return reply({error:'unauthenticated'},401);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return reply({error:'unauthenticated'},401);
  const {sessionId,action='join'}=await req.json();
  if(typeof sessionId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)||!['start','join','end'].includes(action))return reply({error:'invalid_request'},400);
  const key=Deno.env.get('LIVEKIT_API_KEY'),secret=Deno.env.get('LIVEKIT_API_SECRET'),url=Deno.env.get('LIVEKIT_URL');
  if(!key||!secret||!url)return reply({error:'video_unavailable'},503);
  const {data:access,error}=await db.rpc('scheduled_call_action',{p_action:action,p_id:sessionId});
  if(error)return reply({error:error.message},403);
  const room=`kosolola-scheduled-${sessionId}`;
  const sign=async(video:Record<string,unknown>,name='Participante',ttl=60)=>new SignJWT({video,name}).setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(key).setSubject(user.id).setIssuedAt().setNotBefore('0s').setExpirationTime(Math.floor(Date.now()/1000)+ttl).sign(new TextEncoder().encode(secret));
  if(action==='end'){
   const token=await sign({room,roomAdmin:true});
   const endpoint=url.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,'');
   const closed=await fetch(`${endpoint}/twirp/livekit.RoomService/DeleteRoom`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({room}),signal:AbortSignal.timeout(10000)});
   if(!closed.ok&&closed.status!==404)return reply({error:'room_close_failed'},502);
   return reply({ok:true});
  }
  if(!access?.allowed)return reply({waiting:access?.reason==='waiting'});
  const {data:profile}=await db.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
  const token=await sign({room,roomJoin:true,canPublish:true,canSubscribe:true,canPublishData:true},profile?.display_name||'Participante',Math.max(1,Math.min(60,Math.floor((Date.parse(access.ends_at)-Date.now())/1000))));
  return reply({token,url,isHost:access.is_host});
 }catch{return reply({error:'service_unavailable'},503);}
});
