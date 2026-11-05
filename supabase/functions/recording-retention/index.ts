import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Content-Type': 'application/json' };
Deno.serve(async req => {
 if(req.method==='OPTIONS') return new Response('ok',{headers});
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method!=='POST') return reply(405,{error:'method_not_allowed'});
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 try {
  let ids:string[]=[];
  const token=req.headers.get('x-retention-token');
  if(token){
   const check=await admin.rpc('recording_maintenance_authorized',{p_token:token});
   if(check.error||check.data!==true) return reply(401,{error:'unauthorized'});
   const due=await admin.from('call_recordings').select('id').eq('status','completed').or(`expires_at.lte.${new Date().toISOString()},deletion_requested_at.not.is.null`).limit(100);
   if(due.error) throw due.error; ids=(due.data??[]).map(r=>r.id);
  }else{
   const auth=req.headers.get('authorization')?.replace(/^Bearer /i,'');
   if(!auth) return reply(401,{error:'unauthorized'});
   const {data,error}=await admin.auth.getUser(auth);
   if(error||!data.user) return reply(401,{error:'unauthorized'});
   const body=await req.json();
   const row=await admin.from('call_recordings').select('id').eq('id',body.id).eq('initiated_by',data.user.id).eq('status','completed').maybeSingle();
   if(row.error||!row.data) return reply(404,{error:'not_found'});
   ids=[row.data.id];
  }
  let removed=0;
  for(const id of ids){
   const mark=await admin.from('call_recordings').update({deletion_requested_at:new Date().toISOString()}).eq('id',id).eq('status','completed').is('deletion_requested_at',null);
   if(mark.error) throw mark.error;
   const {data:row,error}=await admin.from('call_recordings').select('id,call_id,storage_path').eq('id',id).not('deletion_requested_at','is',null).maybeSingle();
   if(error) throw error;if(!row)continue;
   if(row.storage_path){
    const expected=[`${row.call_id}/${row.id}.mp4`,`${row.call_id}/${row.id}.webm`];
    if(!expected.includes(row.storage_path)) throw new Error('unexpected_storage_path');
    const deleted=await admin.storage.from('call-recordings').remove([row.storage_path]);
    if(deleted.error) throw deleted.error;
   }
   const deleted=await admin.from('call_recordings').delete().eq('id',id).not('deletion_requested_at','is',null);
   if(deleted.error)throw deleted.error;removed++;
  }
  return reply(200,{removed});
 }catch{return reply(500,{error:'removal_failed_retry'});}
});
