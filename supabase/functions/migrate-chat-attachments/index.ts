// Temporary, narrowly scoped maintenance capability. Deployment injects only a token hash
// and an expiry; after the run this endpoint is replaced by a permanently disabled handler.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { localStorageObject, objectKey, publicObjectKeys } from './plan.ts';
const TOKEN_HASH = '__TOKEN_SHA256__';
const EXPIRES = Number('__EXPIRES_AT__');
const json = (value: unknown, status=200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type':'application/json','Cache-Control':'no-store' } });
Deno.serve(async req => {
  if (req.method!=='POST' || !Number.isFinite(EXPIRES) || Date.now()>EXPIRES) return json({error:'Unavailable'},410);
  const token=req.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  if (digest!==TOKEN_HASH) return json({error:'Unauthorized'},401);
  try {
    const url=Deno.env.get('SUPABASE_URL')!;
    const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:external,error:externalError}=await admin.rpc('chat_media_external_references');
    if(externalError) throw new Error('Inventory failed');
    const shared=publicObjectKeys(external || [],url);
    const jobs=new Map<string,{bucket:string;path:string;conversation:string;uploader:string;urls:Set<string>}>();
    for(const table of ['messages','scheduled_messages']) {
      // Keyset pagination prevents silently omitting records at the API row limit.
      let after: string | null=null;
      for(;;) {
        let query=admin.from(table).select(table==='messages'?'id,conversation_id,sender_id,media_url,thumbnail_url':'id,conversation_id,sender_id,media_url').order('id').limit(500);
        if(after) query=query.gt('id',after);
        const {data:rows,error}=await query;
        if(error) throw new Error('Inventory failed');
        for(const row of rows || []) for(const value of [row.media_url,'thumbnail_url' in row ? row.thumbnail_url:null]) {
          if(typeof value!=='string') continue;
          const obj=localStorageObject(value,url); if(!obj) continue;
          const key=objectKey(obj);
          const job=jobs.get(key) || {...obj,conversation:row.conversation_id,uploader:row.sender_id,urls:new Set<string>()};
          job.urls.add(value);jobs.set(key,job);
        }
        if(!rows?.length || rows.length<500) break;
        after=rows[rows.length-1].id;
      }
    }
    const {data:existing,error:existingError}=await admin.from('chat_attachments').select('*').not('legacy_bucket','is',null);
    if(existingError) throw new Error('Inventory failed');
    const mapped=new Map((existing || []).map(a=>[`${a.legacy_bucket}/${a.legacy_path}`,a]));
    // Resume quarantines even if a previous run already rewrote every message URL.
    for(const a of existing || []) if(!a.legacy_quarantined && !jobs.has(`${a.legacy_bucket}/${a.legacy_path}`)) jobs.set(`${a.legacy_bucket}/${a.legacy_path}`,{bucket:a.legacy_bucket,path:a.legacy_path,conversation:a.conversation_id,uploader:a.uploader_id,urls:new Set()});
    const counts={candidates:jobs.size,migrated:0,quarantined:0,shared_public:0,missing:0,failed:0};
    for(const [key,job] of jobs) {
      try {
        let attachment=mapped.get(key);
        const filename=(job.path.split('/').pop() || 'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,160);
        if(!attachment) {
          const id=crypto.randomUUID(),path=`${job.conversation}/${job.uploader}/${id}/${filename}`;
          const {error:copyError}=await admin.storage.from(job.bucket).copy(job.path,path,{destinationBucket:'chat-attachments'});
          if(copyError) {
            const code=String(copyError.statusCode || '');
            if(code==='404' || /not found|does not exist/i.test(copyError.message)) counts.missing++;
            else counts.failed++;
            continue;
          }
          const {data:saved,error:saveError}=await admin.from('chat_attachments').insert({id,conversation_id:job.conversation,uploader_id:job.uploader,object_path:path,legacy_bucket:job.bucket,legacy_path:job.path}).select().single();
          if(saveError) throw new Error('Registry failed');
          attachment=saved;
        }
        const reference=`chat-attachment://${attachment.object_path}`;
        for(const old of job.urls) {
          for(const column of ['media_url','thumbnail_url']) {
            const {error}=await admin.from('messages').update({[column]:reference}).eq(column,old);
            if(error) throw new Error('Reference migration failed');
          }
          const {error}=await admin.from('scheduled_messages').update({media_url:reference}).eq('media_url',old);
          if(error) throw new Error('Reference migration failed');
        }
        counts.migrated++;
        if(shared.has(key)) {
          counts.shared_public++;
          const {error}=await admin.from('chat_attachments').update({legacy_shared:true}).eq('id',attachment.id);
          if(error) throw new Error('Registry failed');
          continue;
        }
        if(!attachment.legacy_quarantined) {
          // Move rather than delete: preserve a recovery copy, outside all client read policies.
          const {error:moveError}=await admin.storage.from(job.bucket).move(job.path,`legacy-recovery/${attachment.id}/${filename}`,{destinationBucket:'chat-attachments'});
          if(moveError) throw new Error('Quarantine failed');
          const {error}=await admin.from('chat_attachments').update({legacy_quarantined:true}).eq('id',attachment.id);
          if(error) throw new Error('Registry failed');
        }
        counts.quarantined++;
      } catch { counts.failed++; }
    }
    return json(counts,counts.failed?500:200);
  } catch { return json({error:'Maintenance failed; no credentials or file paths returned'},500); }
});
