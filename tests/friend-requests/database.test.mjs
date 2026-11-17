import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
await db.exec(`
 create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; create schema cron; create schema net;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,service_role;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now());
 create table profiles(id uuid primary key,display_name text,account_status text default 'active');
 create table user_settings(user_id uuid primary key,language text default 'pt',notifications_enabled boolean default true);
 create type friend_request_status as enum ('pending','accepted','rejected','blocked');
 create table friend_requests(id uuid primary key default gen_random_uuid(),sender_id uuid references profiles,receiver_id uuid references profiles,status friend_request_status default 'pending',created_at timestamptz default now(),updated_at timestamptz default now(),unique(sender_id,receiver_id));
 create table contacts(id uuid primary key default gen_random_uuid(),user_id uuid references profiles,contact_user_id uuid references profiles,is_blocked boolean default false,unique(user_id,contact_user_id));
 alter table friend_requests enable row level security; alter table contacts enable row level security;
 create policy fr_view on friend_requests for select to authenticated using(auth.uid() in (sender_id,receiver_id));
 create policy fr_insert on friend_requests for insert to authenticated with check(auth.uid()=sender_id);
 create policy "Users can update friend requests they receive" on friend_requests for update using(auth.uid() in(sender_id,receiver_id));
 create policy own_contacts on contacts for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
 create policy reciprocal on contacts for insert to authenticated with check(contact_user_id=auth.uid() and exists(select 1 from friend_requests where sender_id=contacts.user_id and receiver_id=auth.uid() and status in('pending','accepted')));
 grant select,insert,update,delete on friend_requests,contacts to authenticated;
 grant select on all tables in schema public to service_role;
 create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
 create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer) returns bigint language sql as $$select 1::bigint$$;
`);
const migration=readFileSync(new URL('../../supabase/migrations/20261117110209_friend_request_alerts.sql',import.meta.url),'utf8');
await db.exec(migration.slice(0,migration.indexOf('do $$ begin\n if not exists(select 1 from pg_publication_tables')));
await db.exec(readFileSync(new URL('../../supabase/migrations/20261117111517_friend_mail_user_lookup.sql',import.meta.url),'utf8'));
for(let n=1;n<=9;n++) {
 await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`synthetic-${n}@example.test`]);
 await db.query('insert into profiles(id,display_name) values($1,$2)',[id(n),`User ${n}`]);
 await db.query('insert into user_settings(user_id) values($1)',[id(n)]);
}
async function actor(n,sql,args=[]) {
 await db.exec(`set role authenticated; set request.jwt.claim.sub='${id(n)}'`);
 try{return await db.query(sql,args);} finally {await db.exec('reset role');}
}
async function request(from,to,req){await actor(from,'insert into friend_requests(id,sender_id,receiver_id) values($1,$2,$3)',[id(req),id(from),id(to)]);}
async function worker(){await db.exec('set role service_role');try{return (await db.query('select * from claim_friend_mail()')).rows;}finally{await db.exec('reset role');}}
await test('new requests queue exactly once; existing users cannot access the queue or worker',async()=>{
 await request(1,2,100);
 assert.equal((await db.query('select count(*)::int n from private.friend_mail_outbox')).rows[0].n,1);
 await assert.rejects(actor(1,'select * from private.friend_mail_outbox'),/permission denied/);
 await assert.rejects(actor(1,'select * from claim_friend_mail()'),/permission denied/);
 await assert.rejects(actor(1,"select friend_mail_authorized('guess')"),/permission denied/);
});
await test('only the recipient can answer; acceptance is atomic, reciprocal and idempotent',async()=>{
 await assert.rejects(actor(1,'select respond_friend_request($1,true)',[id(100)]),/request_unavailable/);
 await assert.rejects(actor(3,'select respond_friend_request($1,true)',[id(100)]),/request_unavailable/);
 await actor(1,"update friend_requests set status='accepted' where id=$1",[id(100)]);
 assert.equal((await db.query('select status from friend_requests where id=$1',[id(100)])).rows[0].status,'pending');
 await actor(2,'select respond_friend_request($1,true)',[id(100)]);
 await actor(2,'select respond_friend_request($1,true)',[id(100)]);
 assert.equal((await db.query('select count(*)::int n from contacts')).rows[0].n,2);
 await assert.rejects(actor(2,'select respond_friend_request($1,false)',[id(100)]),/already_answered/);
 assert.equal((await worker()).length,0);
});
await test('rejecting creates no contact and identity cannot be reassigned',async()=>{
 await request(1,3,101);
 await assert.rejects(actor(3,"update friend_requests set sender_id=$1,status='accepted' where id=$2",[id(4),id(101)]),/identity_immutable/);
 await actor(3,'select respond_friend_request($1,false)',[id(101)]);
 assert.equal((await db.query('select count(*)::int n from contacts')).rows[0].n,2);
});
await test('worker skips opt-out, unconfirmed, blocked and cancelled requests',async()=>{
 await db.query('update user_settings set friend_request_emails=false where user_id=$1',[id(4)]);
 await db.query('update auth.users set email_confirmed_at=null where id=$1',[id(5)]);
 await db.query('insert into contacts(user_id,contact_user_id,is_blocked) values($1,$2,true)',[id(6),id(1)]);
 for(let n=4;n<=7;n++) await request(1,n,100+n);
 await db.query('delete from friend_requests where id=$1',[id(107)]);
 assert.equal((await worker()).length,0);
});
await test('claims lock deliveries, preserve payload, retry safely and finish once',async()=>{
 await request(1,8,108);
 const first=await worker();assert.equal(first.length,1);assert.equal(first[0].attempts,1);assert.equal(first[0].payload.email,'synthetic-8@example.test');
 assert.equal((await worker()).length,0);
 await db.query("update private.friend_mail_outbox set next_attempt_at=now()-interval '1 second' where request_id=$1",[id(108)]);
 await db.query("update profiles set display_name='Changed' where id=$1",[id(1)]);
 const retry=await worker();assert.deepEqual(retry[0].payload,first[0].payload);
 await db.query("select finish_friend_mail($1,1,'sent','stale',null)",[id(108)]);
 assert.equal((await db.query('select state from private.friend_mail_outbox where request_id=$1',[id(108)])).rows[0].state,'pending');
 await db.query("select finish_friend_mail($1,2,'sent','provider-test',null)",[id(108)]);
 const final=(await db.query('select * from private.friend_mail_outbox where request_id=$1',[id(108)])).rows[0];
 assert.equal(final.state,'sent');assert.equal(final.payload,null);
 await db.query('delete from friend_requests where id=$1',[id(108)]);
 await request(1,8,208);
 assert.equal((await db.query('select count(*)::int n from private.friend_mail_outbox where receiver_id=$1',[id(8)])).rows[0].n,1);
});
await test('acceptance rolls back both contacts when the request update fails',async()=>{
 await request(2,9,109);
 await db.exec("create function prevent_test_accept() returns trigger language plpgsql as $$begin raise exception 'synthetic failure'; end$$; create trigger prevent_test_accept before update on friend_requests for each row execute function prevent_test_accept()");
 await assert.rejects(actor(9,'select respond_friend_request($1,true)',[id(109)]),/synthetic failure/);
 assert.equal((await db.query('select count(*)::int n from contacts where user_id=$1 or contact_user_id=$1',[id(9)])).rows[0].n,0);
 await db.exec('drop trigger prevent_test_accept on friend_requests');
});
await db.close();
