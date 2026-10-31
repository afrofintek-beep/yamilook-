import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { PGlite }=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003';
const AB='10000000-0000-4000-8000-000000000001', BC='10000000-0000-4000-8000-000000000002';
await db.exec(`
create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create schema private;create schema storage;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select '{}'::jsonb$$;
grant usage on schema auth,public,storage to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
create table public.conversations(id uuid primary key);
create table public.conversation_participants(conversation_id uuid,user_id uuid,history_cleared_at timestamptz);
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid,sender_id uuid,content text,message_type text,reply_to_id uuid,media_url text,thumbnail_url text,is_deleted boolean default false,expires_at timestamptz,created_at timestamptz default now());
create table public.scheduled_messages(id uuid primary key default gen_random_uuid(),media_url text);
create table public.hidden_messages(message_id uuid,user_id uuid,is_hidden boolean);
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to authenticated,anon;
alter table public.messages enable row level security;
grant select,insert,update on public.messages to authenticated;
create function private.member(c uuid) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.conversation_participants where conversation_id=c and user_id=auth.uid())$$;
grant usage on schema private to authenticated;grant execute on function private.member(uuid) to authenticated;
create policy member_messages on public.messages for all to authenticated using(private.member(conversation_id)) with check(private.member(conversation_id) and sender_id=auth.uid());
insert into public.conversations values('${AB}'),('${BC}');
insert into public.conversation_participants(conversation_id,user_id) values('${AB}','${A}'),('${AB}','${B}'),('${BC}','${B}'),('${BC}','${C}');
insert into storage.buckets values('media','media',true,null);
create policy old_public_media on storage.objects for select using(bucket_id='media');
create policy "Authenticated users can view voice messages" on storage.objects for select to authenticated using(bucket_id='voice-messages');
`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261031204722_private_chat_attachments.sql',import.meta.url),'utf8'));

await db.exec(await readFile(new URL('../../supabase/migrations/20261031205637_chat_attachment_reference_cutover.sql',import.meta.url),'utf8'));

await db.exec(`grant usage on schema public,auth,private to service_role;
grant all on all tables in schema public to service_role;
create table public.public_inventory_fixture(id integer,caption text,media text[],payload jsonb);
insert into public.public_inventory_fixture select x,'u/legacy file.txt',array['u/legacy%20file.txt'],jsonb_build_object('nested',jsonb_build_object('value','u/legacy file.txt')) from generate_series(1,1200) x;
grant select on public.public_inventory_fixture to service_role;`);
const hash='a'.repeat(64);
const url='https://project.supabase.co/storage/v1/object/public/media/u/legacy%20file.txt';
let attachment,refs;
async function service(sql,args=[]){await db.exec('set role service_role');try{return await db.query(sql,args);}finally{await db.exec('reset role');}}
async function transition(action){return (await service('select public.chat_attachment_reference_transition($1,$2,$3) r',[attachment.id,action,hash])).rows[0].r;}
async function values(){return (await db.query('select media_url from public.messages order by id')).rows.map(x=>x.media_url);}
test('atomic reference cutover and recovery',async t=>{
 const messages=(await db.query('insert into public.messages(conversation_id,sender_id,media_url) values($1,$2,$3),($1,$2,$3) returning id',[AB,A,url])).rows.sort((a,b)=>a.id.localeCompare(b.id));
 const scheduled=(await db.query('insert into public.scheduled_messages(media_url) values($1) returning id',[url])).rows[0];
 refs=[...messages.map(x=>({table:'messages',id:x.id,column:'media_url',value:url})),{table:'scheduled_messages',id:scheduled.id,column:'media_url',value:url}];
 attachment=(await db.query("insert into public.chat_attachments(conversation_id,uploader_id,object_path,legacy_bucket,legacy_path,legacy_manifest) values($1,$2,'c/u/private','media','u/legacy file.txt',$3) returning *",[AB,A,{state:'prepared',sha256:hash,original_retained:true,references:refs}])).rows[0];
 await t.test('anonymous and authenticated roles cannot run service maintenance',async()=>{
  for(const role of ['anon','authenticated']){await db.exec('set role '+role);try{await assert.rejects(db.query('select public.chat_attachment_reference_transition($1,$2,$3)',[attachment.id,'cutover',hash]),/permission denied/);await assert.rejects(db.query("select public.chat_attachment_public_reference_counts(array['u/legacy file.txt'])"),/permission denied/);}finally{await db.exec('reset role');}}
 });
 await t.test('inventory finds plain strings, arrays and nested JSON beyond API row caps',async()=>{
  const r=(await service("select public.chat_attachment_public_reference_counts(array['u/legacy file.txt','u/legacy%20file.txt']) r")).rows[0].r;
  assert.equal(r.quarantine_authorized,false);assert.equal(r.matches.filter(x=>x.table==='public_inventory_fixture').length,3);assert.ok(r.matches.filter(x=>x.table==='public_inventory_fixture').every(x=>x.matches===1200));
 });
 await t.test('late conflict rolls back preceding updates and state',async()=>{
  await db.query('update public.messages set media_url=$1 where id=$2',['newer-edit',messages[1].id]);
  await assert.rejects(transition('cutover'),/Concurrent reference change/);
  assert.deepEqual(await values(),[url,'newer-edit']);
  assert.equal((await db.query('select legacy_manifest from public.chat_attachments where id=$1',[attachment.id])).rows[0].legacy_manifest.state,'prepared');
  await db.query('update public.messages set media_url=$1 where id=$2',[url,messages[1].id]);
 });
 await t.test('cutover changes all manifest references in one transaction',async()=>{
  assert.equal((await transition('cutover')).changed,3);assert.deepEqual(await values(),['chat-attachment://c/u/private','chat-attachment://c/u/private']);
  assert.equal((await db.query('select media_url from public.scheduled_messages where id=$1',[scheduled.id])).rows[0].media_url,'chat-attachment://c/u/private');
 });
 await t.test('retry is inert',async()=>{assert.equal((await transition('cutover')).changed,0);});
 await t.test('rollback refuses to overwrite a concurrent edit',async()=>{
  await db.query('update public.messages set media_url=$1 where id=$2',['user-edit',messages[1].id]);await assert.rejects(transition('rollback'),/Concurrent reference change/);
  assert.deepEqual(await values(),['chat-attachment://c/u/private','user-edit']);
  await db.query('update public.messages set media_url=$1 where id=$2',['chat-attachment://c/u/private',messages[1].id]);
 });
 await t.test('rollback restores exact signed/encoded original references and is retryable',async()=>{
  assert.equal((await transition('rollback')).changed,3);assert.deepEqual(await values(),[url,url]);assert.equal((await transition('rollback')).changed,0);
 });
 await t.test('stale digest fails closed',async()=>{await assert.rejects(service('select public.chat_attachment_reference_transition($1,$2,$3)',[attachment.id,'cutover','b'.repeat(64)]),/Verified recovery manifest/);});
 await db.close();
});
