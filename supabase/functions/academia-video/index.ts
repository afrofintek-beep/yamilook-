import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SignJWT } from "https://deno.land/x/jose@v4.14.4/index.ts";
const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const respond = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{...cors,'Content-Type':'application/json'} });
serve(async req => {
  if (req.method==='OPTIONS') return new Response(null,{headers:cors});
  if (req.method!=='POST') return respond({error:'method_not_allowed'},405);
  try {
    const authorization=req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return respond({error:'unauthenticated'},401);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:authError}=await db.auth.getUser();
    if (authError || !user) return respond({error:'unauthenticated'},401);
    const {sessionId,action='join'}=await req.json();
    if (typeof sessionId!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sessionId) || !['join','start','end'].includes(action)) return respond({error:'invalid_request'},400);
    const key=Deno.env.get('LIVEKIT_API_KEY'), secret=Deno.env.get('LIVEKIT_API_SECRET'), url=Deno.env.get('LIVEKIT_URL');
    if (!key || !secret || !url) return respond({error:'video_unavailable'},503);
    const sign=async (video: Record<string,unknown>, ttl='5m') => new SignJWT({video})
      .setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(key).setSubject(user.id)
      .setIssuedAt().setNotBefore('0s').setExpirationTime(ttl).sign(new TextEncoder().encode(secret));
    const roomName=`academia-${sessionId}`;
    if (action==='start' || action==='end') {
      const {error}=await db.rpc('academia_set_live',{p_session:sessionId,p_live:action==='start'});
      if (error) return respond({error:error.message},403);
    }
    if (action==='end') {
      // Closing the server room removes existing participants, not only future joins.
      const adminToken=await sign({room:roomName,roomAdmin:true},'1m');
      const endpoint=url.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,'');
      const result=await fetch(`${endpoint}/twirp/livekit.RoomService/DeleteRoom`,{method:'POST',headers:{Authorization:`Bearer ${adminToken}`,'Content-Type':'application/json'},body:JSON.stringify({room:roomName})});
      if (!result.ok && result.status!==404) {
        console.error('Academia room close failed',result.status);
        return respond({error:'room_close_failed'},502);
      }
      return respond({ok:true});
    }
    const {data:access,error}=await db.rpc('can_join_academia_room',{p_session:sessionId});
    if (error) return respond({error:'access_check_failed'},500);
    if (!access?.allowed) return respond({error:access?.reason || 'forbidden'},403);
    const {data:profile}=await db.from('public_profiles').select('display_name').eq('id',user.id).maybeSingle();
    const token=await new SignJWT({name:profile?.display_name || 'Participante',video:{room:roomName,roomJoin:true,canPublish:true,canSubscribe:true,canPublishData:true,roomCreate:access.is_host===true}})
      .setProtectedHeader({alg:'HS256',typ:'JWT'}).setIssuer(key).setSubject(user.id).setIssuedAt().setNotBefore('0s').setExpirationTime('5m').sign(new TextEncoder().encode(secret));
    return respond({token,url,roomName,isMentor:access.is_host===true});
  } catch (e) {
    console.error('Academia video request failed',e instanceof Error ? e.name : 'unknown');
    return respond({error:'video_request_failed'},500);
  }
});
