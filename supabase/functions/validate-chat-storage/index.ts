import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { prepareObject } from '../migrate-chat-attachments/prepare.ts';
const HASH='__HASH__', EXPIRY=Number('__EXPIRY__'), RUN='__RUN__';
let busy=false;
const answer=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async req=>{
 const token=req.headers.get('Authorization')?.replace(/^Bearer /,'') || '';
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(req.method!=='POST'||Date.now()>EXPIRY||digest!==HASH)return answer({error:'Unavailable'},403);
 if(busy)return answer({error:'Already running'},409);busy=true;
 const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_ANON_KEY')!;
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const client=()=>createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const checks:any[]=[];const users:string[]=[],candidates:string[]=[],conversations:string[]=[],publicPaths:string[]=[],privatePaths:string[]=[];
 let stage='setup';let failure:string|null=null;const cleanupErrors:string[]=[];
 function check(name:string,ok:boolean){checks.push({name,passed:ok});if(!ok)throw new Error(name);}
 async function must(p:any){const r=await p;if(r.error)throw new Error(`${stage}: ${r.error.code||r.error.status||'operation failed'}`);return r.data;}
 const content=new Blob([`Synthetic storage recovery drill ${RUN}`],{type:'text/plain'});
 async function readable(c:any,path:string){const r=await c.storage.from('chat-attachments').download(path);return !r.error&&await r.data.text()===await content.text();}
 try{
  const sessions:any[]=[];
  for(let i=0;i<3;i++){
   stage=`synthetic_user_${i}`;const email=`storage-${RUN}-${i}@yamilook.test`, access=crypto.randomUUID().replaceAll('-','').toUpperCase();
   const row=await must(admin.from('mvp_candidates').insert({full_name:'Storage validation synthetic',email,status:'approved',access_code:access,notes:`Storage drill ${RUN}`}).select('id').single());candidates.push(row.id);
   const password=crypto.randomUUID()+crypto.randomUUID();
   const data=await must(admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{access_code:access,display_name:`Storage test ${i}`,username:`storage_${RUN}_${i}`}}));users.push(data.user.id);
   await must(admin.from('mvp_candidates').update({code_used:true}).eq('id',row.id));
   const c=client();await must(c.auth.signInWithPassword({email,password}));sessions.push(c);
  }
  const [a,b,c]=sessions, anon=client();stage='conversation';
  const conv=await must(admin.from('conversations').insert({type:'direct',created_by:users[0],name:`Storage drill ${RUN}`}).select('id').single());conversations.push(conv.id);
  await must(admin.from('conversation_participants').insert(users.slice(0,2).map(user_id=>({conversation_id:conv.id,user_id}))));
  stage='reservation';check('external reservation denied',!!(await c.rpc('reserve_chat_attachment',{p_conversation_id:conv.id,p_filename:'denied.txt'})).error);
  const reservation=await must(a.rpc('reserve_chat_attachment',{p_conversation_id:conv.id,p_filename:'probe.txt'}));const path=reservation.path;privatePaths.push(path);
  stage='upload';check('other participant cannot upload reservation',!!(await b.storage.from('chat-attachments').upload(path,content)).error);
  await must(a.storage.from('chat-attachments').upload(path,content));
  check('pending upload readable by owner',await readable(a,path));check('pending upload denied to recipient',!await readable(b,path));
  stage='send';const msg=await must(a.from('messages').insert({conversation_id:conv.id,sender_id:users[0],media_url:reservation.reference,message_type:'file',content:'Synthetic storage validation'}).select('id').single());
  stage='access';check('participant downloads exact bytes',await readable(b,path));check('external authenticated download denied',!await readable(c,path));check('anonymous download denied',!await readable(anon,path));
  check('external signing denied',!!(await c.storage.from('chat-attachments').createSignedUrl(path,300)).error);
  check('anonymous signing denied',!!(await anon.storage.from('chat-attachments').createSignedUrl(path,300)).error);
  check('public route denied',!(await fetch(`${url}/storage/v1/object/public/chat-attachments/${path}`)).ok);
  const signed=await must(b.storage.from('chat-attachments').createSignedUrl(path,300));check('participant signed URL downloads', (await fetch(signed.signedUrl)).ok);
  const short=await must(b.storage.from('chat-attachments').createSignedUrl(path,2));
  await new Promise(r=>setTimeout(r,4000));check('expired signed URL denied',!(await fetch(short.signedUrl)).ok);
  stage='hidden';await must(admin.from('hidden_messages').insert({message_id:msg.id,user_id:users[1],is_hidden:true}));check('hidden message denies new download',!await readable(b,path));await must(admin.from('hidden_messages').delete().eq('message_id',msg.id));
  stage='expired';await must(admin.from('messages').update({expires_at:new Date(Date.now()-10000).toISOString()}).eq('id',msg.id));check('expired message denies download',!await readable(b,path));await must(admin.from('messages').update({expires_at:null,is_deleted:true}).eq('id',msg.id));check('deleted message denies download',!await readable(b,path));await must(admin.from('messages').update({is_deleted:false}).eq('id',msg.id));
  stage='removed';await must(admin.from('conversation_participants').delete().eq('conversation_id',conv.id).eq('user_id',users[1]));check('removed participant denied',!await readable(b,path));check('issued URL remains bearer until expiry',(await fetch(signed.signedUrl)).ok);
  stage='prepare_recovery';const legacy=`${users[0]}/storage-drill-${RUN}.txt`;publicPaths.push(legacy);await must(admin.storage.from('media').upload(legacy,content));
  const oldUrl=`${url}/storage/v1/object/public/media/${legacy}`;
  const oldMsg=await must(a.from('messages').insert({conversation_id:conv.id,sender_id:users[0],message_type:'file',media_url:oldUrl}).select('id').single());
  const job={bucket:'media',path:legacy,conversation:conv.id,uploader:users[0],refs:[{table:'messages',id:oldMsg.id,column:'media_url',value:oldUrl}]};
  await prepareObject(admin,job);await prepareObject(admin,job);
  const record=await must(admin.from('chat_attachments').select('*').eq('legacy_bucket','media').eq('legacy_path',legacy).single());privatePaths.push(record.object_path,record.legacy_manifest.recovery_path);
  check('preparation preserves original public access',(await fetch(oldUrl)).ok);
  check('preparation keeps original reference',(await must(admin.from('messages').select('media_url').eq('id',oldMsg.id).single())).media_url===oldUrl);
  check('recovery copy denied to member',!await readable(a,record.legacy_manifest.recovery_path));check('recovery copy denied to external',!await readable(c,record.legacy_manifest.recovery_path));check('recovery copy denied to anonymous',!await readable(anon,record.legacy_manifest.recovery_path));
  // Simulate loss only of our disposable synthetic original, then restore via Storage API.
  stage='restore';await must(admin.storage.from('media').remove([legacy]));await must(admin.storage.from('chat-attachments').copy(record.legacy_manifest.recovery_path,legacy,{destinationBucket:'media'}));
  const restored=await must(admin.storage.from('media').download(legacy));check('restoration exact bytes',await restored.text()===await content.text());
  check('restored original URL works',(await fetch(oldUrl)).ok);
  stage='muxi';const posts=await must(admin.from('posts').select('media_urls').not('media_urls','is',null).limit(30));
  const sample=posts.flatMap((p:any)=>p.media_urls||[]).find((u:string)=>u.startsWith(`${url}/storage/v1/object/public/media/`));
  if(sample)check('existing MUXI public sample accessible',(await fetch(sample,{method:'HEAD'})).ok);
  else checks.push({name:'existing MUXI public sample',passed:null,reason:'No eligible sample'});
 }catch(e){failure=`${stage}: ${e instanceof Error?e.message:'failed'}`;}
 finally{
  async function clean(label:string,p:any){try{const r=await p;if(r.error)cleanupErrors.push(label);}catch{cleanupErrors.push(label);}}
  // Registry lookup captures copies even after an interrupted prepare call.
  if(conversations.length){const r=await admin.from('chat_attachments').select('id,object_path,legacy_bucket').in('conversation_id',conversations);for(const x of r.data||[]){privatePaths.push(x.object_path);if(x.legacy_bucket)privatePaths.push(`legacy-recovery/${x.id}/original`);}}
  if(privatePaths.length)await clean('private objects',admin.storage.from('chat-attachments').remove([...new Set(privatePaths)]));
  if(publicPaths.length)await clean('public test objects',admin.storage.from('media').remove(publicPaths));
  if(conversations.length){await clean('messages',admin.from('messages').delete().in('conversation_id',conversations));await clean('registry',admin.from('chat_attachments').delete().in('conversation_id',conversations));await clean('participants',admin.from('conversation_participants').delete().in('conversation_id',conversations));await clean('conversations',admin.from('conversations').delete().in('id',conversations));}
  if(candidates.length)await clean('candidates',admin.from('mvp_candidates').delete().in('id',candidates));
  for(const id of users)await clean('synthetic user',admin.auth.admin.deleteUser(id));
  if(users.length){await clean('synthetic settings',admin.from('user_settings').delete().in('user_id',users));await clean('synthetic profiles',admin.from('profiles').delete().in('id',users));}
 }
 return answer({run:RUN,checks,failure,cleanupErrors},failure||cleanupErrors.length?500:200);
});
