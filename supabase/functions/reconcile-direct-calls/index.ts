import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SignJWT } from 'https://deno.land/x/jose@v4.14.4/index.ts';
import { callHasBothPeers, missingPeerGraceExpired } from './decision.ts';

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods':'POST, OPTIONS' };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), {status,headers:{...cors,'Content-Type':'application/json'}});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const terminal = ['ended','missed','declined','failed','cancelled'];
const rate = new Map<string,{count:number;until:number}>();

serve(async req => {
  if(req.method==='OPTIONS')return new Response(null,{headers:cors});
  if(req.method!=='POST')return json({error:'method_not_allowed'},405);
  try {
    const authorization=req.headers.get('Authorization');
    if(!authorization?.startsWith('Bearer '))return json({error:'unauthenticated'},401);
    const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
    const client=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)return json({error:'unauthenticated'},401);
    const {error:sessionError}=await client.rpc('account_current_session_id');
    if(sessionError)return json({error:'session_expired'},401);
    const now=Date.now();
    for(const [id,value] of rate)if(value.until<=now)rate.delete(id);
    const limit=rate.get(user.id);
    if(limit&&limit.count>=20)return json({error:'rate_limited'},429);
    rate.set(user.id,{count:(limit?.count||0)+1,until:limit?.until||now+60_000});
    const body=await req.json().catch(()=>({}));
    if((body.callId!==undefined&&(typeof body.callId!=='string'||!uuid.test(body.callId))) ||
       (body.calleeId!==undefined&&(typeof body.calleeId!=='string'||!uuid.test(body.calleeId))))return json({error:'invalid_request'},400);
    const key=Deno.env.get('LIVEKIT_API_KEY'),secret=Deno.env.get('LIVEKIT_API_SECRET'),host=Deno.env.get('LIVEKIT_URL');
    if(!key||!secret||!host)return json({error:'media_unavailable'},503);
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const endpoint=host.replace(/^wss:/,'https:').replace(/^ws:/,'http:').replace(/\/$/,'');
    const roomApi=async(method:string,room:string) => {
      const video=method==='DeleteRoom'?{roomCreate:true}:{room,roomAdmin:true};
      const token=await new SignJWT({video}).setProtectedHeader({alg:'HS256',typ:'JWT'})
        .setIssuer(key).setSubject(user.id).setIssuedAt().setNotBefore('0s').setExpirationTime('1m')
        .sign(new TextEncoder().encode(secret));
      return fetch(`${endpoint}/twirp/livekit.RoomService/${method}`,{method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({room}),signal:AbortSignal.timeout(5000)});
    };
    const cutoff=new Date(Date.now()-90_000).toISOString();
    const fields='id,caller_id,callee_id,status,created_at,updated_at,started_at';
    let query=admin.from('calls').select(fields).eq('is_group_call',false).eq('sdp_offer->>transport','livekit-v1');
    if(body.callId) {
      query=query.eq('id',body.callId).or(`caller_id.eq.${user.id},callee_id.eq.${user.id}`);
    } else {
      const accounts=[user.id,...(body.calleeId?[body.calleeId]:[])];
      // No rows or participant identities are returned to the client. Actual
      // server presence is checked before clearing any target's stale busy row.
      query=query.in('status',['ringing','connecting','ongoing']).lt('updated_at',cutoff)
        .or(accounts.flatMap(id=>[`caller_id.eq.${id}`,`callee_id.eq.${id}`]).join(','));
    }
    const {data:calls,error}=await query.limit(10);
    if(error)throw error;
    for(const call of calls||[]) {
      if(body.callId&&call.caller_id!==user.id&&call.callee_id!==user.id)return json({error:'forbidden'},403);
      const room=`call-${call.id}`;
      if(terminal.includes(call.status)) {
        const closed=await roomApi('DeleteRoom',room);
        if(!closed.ok&&closed.status!==404)throw new Error('room_close_failed');
        await admin.from('direct_call_recovery_observations').delete().eq('call_id',call.id);
        continue;
      }
      if(call.updated_at>=cutoff)continue;
      const result=await roomApi('ListParticipants',room);
      if(!result.ok&&result.status!==404)throw new Error('presence_unavailable');
      const participants=result.status===404?[]:((await result.json()).participants??[]);
      if(!Array.isArray(participants))throw new Error('invalid_presence');
      const identities=participants.map((p:{identity?:string})=>p.identity||'');
      if(callHasBothPeers(call.caller_id,call.callee_id,identities)) {
        await admin.from('calls').update({updated_at:new Date().toISOString()}).eq('id',call.id).eq('status',call.status).eq('updated_at',call.updated_at);
        await admin.from('direct_call_recovery_observations').delete().eq('call_id',call.id);
        continue;
      }
      if(call.status==='ongoing') {
        const {error:observeError}=await admin.from('direct_call_recovery_observations').upsert({call_id:call.id},{onConflict:'call_id',ignoreDuplicates:true});
        if(observeError)throw observeError;
        const {data:observation,error:readError}=await admin.from('direct_call_recovery_observations').select('first_missing_at').eq('call_id',call.id).single();
        if(readError)throw readError;
        if(!missingPeerGraceExpired(observation.first_missing_at,Date.now()))continue;
      }
      const status=call.status==='ringing'?'missed':call.status==='ongoing'?'ended':'failed';
      const reason=call.status==='ringing'?'no_answer':call.status==='ongoing'?'peer_disconnected':'setup_timeout';
      const now=new Date().toISOString();
      const {data:ended,error:endError}=await admin.from('calls').update({status,end_reason:reason,ended_at:now,
        duration_seconds:call.started_at?Math.max(0,Math.floor((Date.now()-Date.parse(call.started_at))/1000)):0})
        .eq('id',call.id).eq('status',call.status).eq('updated_at',call.updated_at).select('id').maybeSingle();
      if(endError)throw endError;
      if(!ended)continue; // An answer/recovery won the race; do not close its room.
      const {error:memberError}=await admin.from('call_participants').update({status:'left',left_at:now})
        .eq('call_id',call.id).in('status',['ringing','connected','on_hold','waiting','invited']);
      if(memberError)throw memberError;
      const closed=await roomApi('DeleteRoom',room);
      if(!closed.ok&&closed.status!==404)throw new Error('room_close_failed');
      await admin.from('direct_call_recovery_observations').delete().eq('call_id',call.id);
    }
    return json({ok:true});
  } catch { console.error('Direct call reconciliation could not be confirmed');return json({error:'reconciliation_unavailable'},503); }
});
