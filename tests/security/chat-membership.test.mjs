// Real PostgreSQL authorization tests in an isolated WASM database, never production.
// Install tooling outside the repo: npm install --prefix /tmp/papos-security @electric-sql/pglite@0.5.11
// PGLITE_MODULE=/tmp/papos-security/node_modules/@electric-sql/pglite/dist/index.js node --test tests/security/chat-membership.test.mjs
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003';
const db=new PGlite();
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth,public to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
create type public.group_member_role as enum ('admin','member');
create table public.profiles(id uuid primary key);
create table public.conversations(id uuid primary key default gen_random_uuid(),type text not null default 'direct',name text,avatar_url text,created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now(),disappearing_messages_duration text);
create table public.conversation_participants(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations(id),user_id uuid references public.profiles(id),joined_at timestamptz default now(),last_read_at timestamptz,is_muted boolean default false,is_pinned boolean default false,is_archived boolean default false,role public.group_member_role default 'member',history_cleared_at timestamptz,unique(conversation_id,user_id));
create table public.group_invites(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations(id),code text unique,created_by uuid,expires_at timestamptz,max_uses integer,uses_count integer not null default 0,is_active boolean not null default true,created_at timestamptz default now(),updated_at timestamptz default now());
create table public.messages(id uuid primary key default gen_random_uuid(),conversation_id uuid references public.conversations(id),content text);
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.group_invites enable row level security;
alter table public.messages enable row level security;
grant all on public.conversations,public.conversation_participants,public.group_invites,public.messages to anon,authenticated;
insert into public.profiles values('${A}'),('${B}'),('${C}');
`);
await db.exec(await readFile(new URL('./chat-baseline-functions.sql',import.meta.url),'utf8'));
await db.exec(`
create policy legacy_self_join on public.conversation_participants for insert with check(user_id=auth.uid());
create policy legacy_self_update on public.conversation_participants for update using(user_id=auth.uid());
create policy legacy_read on public.conversation_participants for select using(public.user_is_participant(conversation_id));
create policy legacy_conversations on public.conversations for all using(public.user_is_participant(id)) with check(created_by=auth.uid());
create policy member_messages on public.messages for select using(public.user_is_participant(conversation_id));
`);
async function asUser(id,sql,params=[]) {
 await db.exec('set role authenticated');
 try { await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]); return await db.query(sql,params); }
 finally { await db.exec('reset role'); }
}
async function denied(id,sql,params=[]) { await assert.rejects(asUser(id,sql,params),/permission denied|row-level security/i); }
let group,direct;
test('membership boundary and legitimate workflows',async t=>{
 await t.test('baseline reproduces unauthorised self-entry without personal data',async()=>{
  const row=await db.query("insert into public.conversations(created_by,type,name) values($1,'group','Synthetic baseline') returning id",[A]);
  await asUser(C,"insert into public.conversation_participants(conversation_id,user_id,role) values($1,$2,'admin')",[row.rows[0].id,C]);
  assert.equal((await asUser(C,'select public.is_group_admin($1,$2) allowed',[C,row.rows[0].id])).rows[0].allowed,true);
  await db.query('delete from public.conversation_participants where conversation_id=$1',[row.rows[0].id]);
  await db.query('delete from public.conversations where id=$1',[row.rows[0].id]);
 });
 await db.exec(await readFile(new URL('../../supabase/migrations/20261024001248_secure_chat_membership.sql',import.meta.url),'utf8'));
 await t.test('A creates a group atomically, A admin and B member',async()=>{
  group=(await asUser(A,'select public.create_chat_conversation($1,$2,null) c',[[B],'Security test'])).rows[0].c;
  assert.equal((await asUser(A,'select role from public.conversation_participants where conversation_id=$1 and user_id=$2',[group.id,A])).rows[0].role,'admin');
  assert.equal((await asUser(B,'select role from public.conversation_participants where conversation_id=$1 and user_id=$2',[group.id,B])).rows[0].role,'member');
  await db.query("insert into public.messages(conversation_id,content) values($1,'SYNTHETIC ONLY')",[group.id]);
 });
 await t.test('C cannot join, see participants, conversation or messages',async()=>{
  await denied(C,'insert into public.conversation_participants(conversation_id,user_id) values($1,$2)',[group.id,C]);
  for(const table of ['conversations','conversation_participants','messages']) {
   const column=table==='conversations'?'id':'conversation_id';
   assert.equal((await asUser(C,`select * from public.${table} where ${column}=$1`,[group.id])).rows.length,0);
  }
 });
 await t.test('B cannot promote self or change membership identity',async()=>{
  await denied(B,"update public.conversation_participants set role='admin' where conversation_id=$1 and user_id=$2",[group.id,B]);
  await denied(B,'update public.conversation_participants set user_id=$1 where conversation_id=$2 and user_id=$3',[C,group.id,B]);
  await denied(B,'update public.conversation_participants set conversation_id=$1 where conversation_id=$1 and user_id=$2',[group.id,B]);
  assert.equal((await asUser(B,"select public.set_member_role($1,$2,'admin') r",[group.id,B])).rows[0].r.success,false);
 });
 await t.test('B can mute, archive, pin and clear own history',async()=>{
  await asUser(B,'update public.conversation_participants set is_muted=true,is_pinned=true,is_archived=true,history_cleared_at=now(),last_read_at=now() where conversation_id=$1 and user_id=$2',[group.id,B]);
  assert.equal((await asUser(B,'select is_muted from public.conversation_participants where conversation_id=$1 and user_id=$2',[group.id,B])).rows[0].is_muted,true);
  assert.equal((await asUser(B,'update public.conversation_participants set is_muted=true where conversation_id=$1 and user_id=$2 returning id',[group.id,A])).rows.length,0);
 });
 await t.test('direct chats deduplicate both directions and keep two members',async()=>{
  direct=(await asUser(A,'select public.create_chat_conversation($1,null,null) c',[[B]])).rows[0].c;
  const reverse=(await asUser(B,'select public.create_chat_conversation($1,null,null) c',[[A]])).rows[0].c;
  assert.equal(direct.id,reverse.id);
  await denied(A,'insert into public.conversation_participants(conversation_id,user_id) values($1,$2)',[direct.id,C]);
  await denied(B,'update public.conversations set created_by=$1 where id=$2',[B,direct.id]);
  await denied(A,"insert into public.conversations(type,created_by) values('direct',$1)",[A]);
 });
 await t.test('invalid participant rolls back the entire creation',async()=>{
  const before=(await db.query('select count(*) n from public.conversations')).rows[0].n;
  await assert.rejects(asUser(A,'select public.create_chat_conversation($1,null,null)',[['00000000-0000-4000-8000-999999999999']]),/Participant unavailable/);
  assert.equal((await db.query('select count(*) n from public.conversations')).rows[0].n,before);
 });
 await t.test('only admin creates invite, code cannot be reassigned or counter reset',async()=>{
  await denied(B,'insert into public.group_invites(conversation_id,code,created_by) values($1,$2,$3)',[group.id,'denied',B]);
  await asUser(A,'insert into public.group_invites(conversation_id,code,created_by,max_uses) values($1,$2,$3,1)',[group.id,'single-use',A]);
  await denied(A,'update public.group_invites set conversation_id=$1 where code=$2',[direct.id,'single-use']);
  await denied(A,'update public.group_invites set uses_count=0 where code=$1',['single-use']);
 });
 await t.test('code preview works for C without listing invites; join grants member only',async()=>{
  assert.equal((await asUser(C,'select * from public.group_invites')).rows.length,0);
  assert.equal((await asUser(C,'select public.preview_chat_invite($1) r',['single-use'])).rows[0].r.success,true);
  assert.equal((await asUser(C,'select public.use_group_invite($1) r',['single-use'])).rows[0].r.success,true);
  assert.equal((await asUser(C,'select role from public.conversation_participants where conversation_id=$1 and user_id=$2',[group.id,C])).rows[0].role,'member');
  assert.equal((await asUser(C,'select public.use_group_invite($1) r',['single-use'])).rows[0].r.already_member,true);
  assert.equal((await db.query("select uses_count from public.group_invites where code='single-use'")).rows[0].uses_count,1);
 });
 await t.test('expired, revoked and exhausted invites deny new entry',async()=>{
  await asUser(C,'delete from public.conversation_participants where conversation_id=$1 and user_id=$2',[group.id,C]);
  assert.equal((await asUser(C,'select public.use_group_invite($1) r',['single-use'])).rows[0].r.success,false);
  await db.query('insert into public.group_invites(conversation_id,code,created_by,expires_at,is_active) values($1,$2,$3,now()-interval \'1 day\',true),($1,$4,$3,null,false)',[group.id,'expired',A,'revoked']);
  for(const code of ['expired','revoked','missing']) assert.equal((await asUser(C,'select public.use_group_invite($1) r',[code])).rows[0].r.success,false);
 });
 await t.test('admin RPCs still add, promote, demote, update and remove members',async()=>{
  assert.equal((await asUser(A,"select public.add_group_member($1,$2,'member') r",[group.id,C])).rows[0].r.success,true);
  assert.equal((await asUser(A,"select public.set_member_role($1,$2,'admin') r",[group.id,C])).rows[0].r.success,true);
  assert.equal((await asUser(A,"select public.update_group_info($1,'New name',null) r",[group.id])).rows[0].r.success,true);
  assert.equal((await asUser(A,"select public.set_member_role($1,$2,'member') r",[group.id,C])).rows[0].r.success,true);
  assert.equal((await asUser(A,'select public.remove_group_member($1,$2) r',[group.id,C])).rows[0].r.success,true);
 });
 await t.test('anonymous cannot execute membership mutations',async()=>{
  await db.exec('set role anon');
  try { await assert.rejects(db.query('select public.create_chat_conversation($1,null,null)',[[B]]),/permission denied/); await assert.rejects(db.query('select public.use_group_invite($1)',['single-use']),/permission denied/); }
  finally { await db.exec('reset role'); }
 });
 await db.close();
});
