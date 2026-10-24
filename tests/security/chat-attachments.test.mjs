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
`);
await db.exec(await readFile(new URL('../../supabase/migrations/20261024003034_private_chat_attachments.sql',import.meta.url),'utf8'));
async function asUser(id,sql,args=[]) {
 await db.exec('set role authenticated');
 try{await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);return await db.query(sql,args);}
 finally{await db.exec('reset role');}
}
let path,ref,messageId;
test('private attachments authorization',async t=>{
 await t.test('only a member can reserve an upload',async()=>{
  await assert.rejects(asUser(C,'select public.reserve_chat_attachment($1,$2)',[AB,'bank.pdf']),/Conversation unavailable/);
  const r=(await asUser(A,'select public.reserve_chat_attachment($1,$2) r',[AB,'bank.pdf'])).rows[0].r;
  path=r.path;ref=r.reference;assert.ok(ref.startsWith('chat-attachment://'));
 });
 await t.test('only the reserving member uploads that exact path',async()=>{
  await assert.rejects(asUser(B,"insert into storage.objects(bucket_id,name) values('chat-attachments',$1)",[path]),/row-level security/);
  await asUser(A,"insert into storage.objects(bucket_id,name) values('chat-attachments',$1)",[path]);
  await assert.rejects(asUser(A,"insert into storage.objects(bucket_id,name) values('chat-attachments','unreserved')"),/row-level security/);
 });
 await t.test('unsent attachment is visible only to its uploader',async()=>{
  assert.equal((await asUser(A,'select * from storage.objects where name=$1',[path])).rows.length,1);
  assert.equal((await asUser(B,'select * from storage.objects where name=$1',[path])).rows.length,0);
 });
 await t.test('after sending B can read but C cannot',async()=>{
  messageId=(await asUser(A,'insert into public.messages(conversation_id,sender_id,media_url) values($1,$2,$3) returning id',[AB,A,ref])).rows[0].id;
  assert.equal((await asUser(B,'select * from storage.objects where name=$1',[path])).rows.length,1);
  assert.equal((await asUser(C,'select * from storage.objects where name=$1',[path])).rows.length,0);
 });
 await t.test('C cannot claim a known private reference through another chat',async()=>{
  await assert.rejects(asUser(C,'insert into public.messages(conversation_id,sender_id,media_url) values($1,$2,$3)',[BC,C,ref]),/Attachment unavailable/);
  await assert.rejects(asUser(C,'insert into public.messages(conversation_id,sender_id,thumbnail_url) values($1,$2,$3)',[BC,C,ref]),/Attachment unavailable/);
 });
 await t.test('authorized forwarding grants access through the destination message',async()=>{
  await asUser(B,'insert into public.messages(conversation_id,sender_id,media_url) values($1,$2,$3)',[BC,B,ref]);
  assert.equal((await asUser(C,'select * from storage.objects where name=$1',[path])).rows.length,1);
 });
 await t.test('leaving a conversation removes future access through it',async()=>{
  await db.query('delete from public.conversation_participants where conversation_id=$1 and user_id=$2',[BC,C]);
  assert.equal((await asUser(C,'select * from storage.objects where name=$1',[path])).rows.length,0);
 });
 await t.test('expired or deleted messages no longer authorize downloads',async()=>{
  await db.query("update public.messages set expires_at=now()-interval '1 day' where media_url=$1",[ref]);
  assert.equal((await asUser(B,'select * from storage.objects where name=$1',[path])).rows.length,0);
 });
 await t.test('clients cannot modify storage objects or registry',async()=>{
  assert.equal((await asUser(A,'delete from storage.objects where name=$1 returning id',[path])).rows.length,0);
  await assert.rejects(asUser(A,'select * from public.chat_attachments'),/permission denied/);
 });
 await t.test('public social bucket remains public and anonymous private reads fail',async()=>{
  assert.equal((await db.query("select public from storage.buckets where id='media'")).rows[0].public,true);
  assert.equal((await db.query("select public from storage.buckets where id='chat-attachments'")).rows[0].public,false);
  await db.exec('set role anon');try{assert.equal((await db.query("select * from storage.objects where bucket_id='chat-attachments'")).rows.length,0);await assert.rejects(db.query('select public.reserve_chat_attachment($1,$2)',[AB,'test']),/permission denied/);}finally{await db.exec('reset role');}
 });
 await db.close();
});
