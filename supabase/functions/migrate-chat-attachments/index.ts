// Preparation only. Never rewrites message references or moves/deletes originals.
// Deploy with a short-lived capability only after hosted Storage validation.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { localStorageObject, objectKey } from './plan.ts';
import { prepareObject } from './prepare.ts';
const TOKEN_HASH = '__TOKEN_SHA256__';
const EXPIRES = Number('__EXPIRES_AT__');
const json = (value: unknown, status=200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' } });
Deno.serve(async req => {
  if (req.method!=='POST' || !Number.isFinite(EXPIRES) || Date.now()>EXPIRES) return json({error:'Unavailable'},410);
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  if (digest!==TOKEN_HASH) return json({error:'Unauthorized'},401);
  try {
    const body=await req.json();
    if (!['inventory','prepare'].includes(body.mode)) return json({error:'Use inventory or prepare; cutover is disabled'},400);
    const url=Deno.env.get('SUPABASE_URL')!;
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    // One explicit object per prepare request bounds work. Repeated requests reuse its registry.
    const jobs=new Map<string,any>();
    for(const table of ['messages','scheduled_messages']) {
      let after: string | null=null;
      for(;;) {
        let query=admin.from(table).select(table==='messages'?'id,conversation_id,sender_id,media_url,thumbnail_url':'id,conversation_id,sender_id,media_url').order('id').limit(100);
        if(after) query=query.gt('id',after);
        const {data:rows,error}=await query;
        if(error) throw new Error('Inventory failed');
        for(const row of rows || []) for(const column of ['media_url','thumbnail_url']) {
          const value=row[column]; if(typeof value!=='string') continue;
          const obj=localStorageObject(value,url); if(!obj) continue;
          const key=objectKey(obj);
          const job=jobs.get(key) || {...obj,conversation:row.conversation_id,uploader:row.sender_id,refs:[]};
          job.refs.push({table,id:row.id,column,value});jobs.set(key,job);
        }
        // Continue until empty: do not mistake a server row cap for end of inventory.
        if(!rows?.length) break;
        after=rows[rows.length-1].id;
      }
    }
    if(body.mode==='inventory') return json({candidates:jobs.size,mode:'inventory',mutations:0,cutover_enabled:false});
    const job=jobs.get(`${body.bucket}/${body.path}`);
    if(!job) return json({error:'Candidate unavailable'},404);
    const result=await prepareObject(admin,job);
    return json({...result,cutover_enabled:false});
  } catch { return json({error:'Preparation failed; originals and message references retained'},500); }
});
