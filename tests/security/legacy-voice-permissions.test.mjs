import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',C='00000000-0000-4000-8000-000000000003';
const AB='10000000-0000-4000-8000-000000000001',BC='10000000-0000-4000-8000-000000000002';
const legacy='https://example.supabase.co/storage/v1/object/sign/voice-messages/u/voice.webm?token=expired';
await db.exec(`
create role authenticated; create role anon; create role service_role bypassrls;
create schema auth; create schema private; create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('role',current_setting('request.jwt.claim.role',true))$$;
grant usage on schema auth,public,storage to authenticated,anon;
create table public.conversations(id uuid primary key);
create table public.conversation_participants(conversation_id uuid,user_id uuid,history_cleared_at timestamptz);
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_id uuid,content text,message_type text,reply_to_id uuid,media_url text,thumbnail_url text,is_deleted boolean default false,is_view_once boolean default false,expires_at timestamptz,created_at timestamptz default now(),updated_at timestamptz,read_by jsonb,delivered_at timestamptz,future_protected_field text);
create table public.scheduled_messages(id uuid primary key default gen_random_uuid(),media_url text);
create table public.hidden_messages(message_id uuid,user_id uuid,is_hidden boolean);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated,anon;
grant select,insert,update on public.messages to authenticated;
grant insert on public.scheduled_messages to authenticated;
insert into public.conversations values('${AB}'),('${BC}');
insert into public.conversation_participants(conversation_id,user_id) values('${AB}','${A}'),('${AB}','${B}'),('${BC}','${B}'),('${BC}','${C}');
insert into storage.buckets values('media','media',true,null),('voice-messages','voice-messages',false,null);
create policy public_social on storage.objects for select using(bucket_id='media');
create policy "Authenticated users can view voice messages" on storage.objects for select to authenticated using(bucket_id='voice-messages');
create policy old_voice_upload on storage.objects for insert to authenticated with check(bucket_id='voice-messages');
create policy old_voice_delete on storage.objects for delete to authenticated using(bucket_id='voice-messages');
`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261031204722_private_chat_attachments.sql',import.meta.url),'utf8'));
await db.exec(`create trigger restrict_fields before update on public.messages for each row execute function public.messages_restrict_read_marking();`);
const message=(await db.query('insert into public.messages(conversation_id,sender_id,media_url) values($1,$2,$3) returning id',[AB,A,legacy])).rows[0].id;
await db.exec("insert into storage.objects(bucket_id,name) values('voice-messages','u/voice.webm'),('voice-messages','u/orphan.webm'),('media','public/photo.jpg');");
async function asUser(id,sql,args=[]){
 await db.exec('set role authenticated');
 try {await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); return await db.query(sql,args);}
 finally {await db.exec('reset role'); await db.exec("select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claim.role','service_role',false)");}
}
const readVoice = id => asUser(id,"select name from storage.objects where bucket_id='voice-messages' order by name");
test('legacy voice permissions and regression',async t=>{
 await t.test('reproduces broad authenticated disclosure before patch',async()=>assert.equal((await readVoice(C)).rows.length,2));
 await db.exec(await readFile(new URL('../../supabase/migrations/20261103201434_kosolola_legacy_voice_permissions.sql',import.meta.url),'utf8'));
 await t.test('only sender and recipient read, orphan and outsider denied',async()=>{
  assert.deepEqual((await readVoice(A)).rows,[{name:'u/voice.webm'}]);
  assert.deepEqual((await readVoice(B)).rows,[{name:'u/voice.webm'}]);
  assert.deepEqual((await readVoice(C)).rows,[]);
 });
 await t.test('anonymous access denied; public MUXI remains readable',async()=>{
  await db.exec('set role anon');
  try {assert.equal((await db.query("select * from storage.objects where bucket_id='voice-messages'")).rows.length,0);assert.equal((await db.query("select * from storage.objects where bucket_id='media'")).rows.length,1);}
  finally {await db.exec('reset role');}
  assert.equal((await db.query("select public from storage.buckets where id='media'")).rows[0].public,true);
 });
 await t.test('guessing a URL cannot grant access in messages, thumbnails or scheduled messages',async()=>{
  for(const col of ['media_url','thumbnail_url']) await assert.rejects(asUser(C,`insert into public.messages(conversation_id,sender_id,${col}) values($1,$2,$3)`,[BC,C,legacy]),/Attachment unavailable/);
  await assert.rejects(asUser(C,'insert into public.scheduled_messages(media_url) values($1)',[legacy]),/Attachment unavailable/);
 });
 await t.test('authorized forwarding remains possible',async()=>{
  const forwarded=(await asUser(B,'insert into public.messages(conversation_id,sender_id,media_url) values($1,$2,$3) returning id',[BC,B,legacy])).rows[0].id;
  assert.equal((await readVoice(C)).rows.length,1);
  await db.query('delete from public.messages where id=$1',[forwarded]);
  assert.equal((await readVoice(C)).rows.length,0);
 });
 await t.test('membership revocation denies the next read',async()=>{
  await db.query('delete from public.conversation_participants where conversation_id=$1 and user_id=$2',[AB,B]);
  assert.equal((await readVoice(B)).rows.length,0);
  await db.query('insert into public.conversation_participants(conversation_id,user_id) values($1,$2)',[AB,B]);
 });
 await t.test('deletion, expiry, hidden messages and cleared history revoke access',async()=>{
  for(const field of ['is_deleted=true',"expires_at=now()-interval '1 minute'"]){
   await db.query(`update public.messages set ${field} where id=$1`,[message]);
   assert.equal((await readVoice(B)).rows.length,0);
   await db.query('update public.messages set is_deleted=false,expires_at=null where id=$1',[message]);
  }
  await db.query('insert into public.hidden_messages values($1,$2,true)',[message,B]);
  assert.equal((await readVoice(B)).rows.length,0);
  await db.exec('delete from public.hidden_messages');
  await db.query('update public.conversation_participants set history_cleared_at=now() where user_id=$1',[B]);
  assert.equal((await readVoice(B)).rows.length,0);
  await db.exec('update public.conversation_participants set history_cleared_at=null');
 });
 await t.test('recipient cannot change privacy fields, thumbnails or future columns; receipts work',async()=>{
  for(const patch of ['is_deleted=true','is_view_once=true',"expires_at=now()+interval '1 day'","thumbnail_url='other'","future_protected_field='changed'"]){
   await assert.rejects(asUser(B,`update public.messages set ${patch} where id=$1`,[message]),/Non-sender/);
  }
  await asUser(B,'update public.messages set delivered_at=now() where id=$1',[message]);
 });
 await t.test('originals cannot be overwritten or deleted and old uploads are closed',async()=>{
  await assert.rejects(asUser(A,"insert into storage.objects(bucket_id,name) values('voice-messages','u/new.webm')"),/row-level security/);
  assert.equal((await asUser(A,"delete from storage.objects where bucket_id='voice-messages' returning id")).rows.length,0);
  assert.equal((await asUser(A,"update storage.objects set name='u/replaced' where bucket_id='voice-messages' returning id")).rows.length,0);
  assert.equal((await db.query("select count(*)::int n from storage.objects where bucket_id='voice-messages'")).rows[0].n,2);
 });
 await t.test('restrictive boundary survives an accidentally broad select policy',async()=>{
  await db.exec('create policy accidental_broad_read on storage.objects for select using(true)');
  assert.equal((await readVoice(C)).rows.length,0);
  await db.exec('drop policy accidental_broad_read on storage.objects');
 });
 await t.test('private converted copies still authorize their retained originals, recovery does not',async()=>{
  await db.query("insert into public.chat_attachments(conversation_id,uploader_id,object_path,legacy_bucket,legacy_path) values($1,$2,'converted/file','voice-messages','u/voice.webm')",[AB,A]);
  await db.query("update public.messages set media_url='chat-attachment://converted/file' where id=$1",[message]);
  assert.equal((await readVoice(B)).rows.length,1);
  await db.query('update public.messages set is_deleted=true where id=$1',[message]);
  assert.equal((await readVoice(B)).rows.length,0);
 });
 await t.test('parser normalizes encodings and rejects malformed paths',async()=>{
  const base='https://example.supabase.co/storage/v1/object/public/voice-messages/';
  assert.equal((await db.query('select private.legacy_chat_voice_path($1) p',[base+'u/a%20b.webm'])).rows[0].p,'u/a b.webm');
  for(const path of ['u/%QQ','u/%00','u/%2e%2e%2fx','u//f']) assert.equal((await db.query('select private.legacy_chat_voice_path($1) p',[base+path])).rows[0].p,null);
 });
 await db.close();
});
