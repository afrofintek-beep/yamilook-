// Run with PGLITE_MODULE=/absolute/path/to/@electric-sql/pglite/dist/index.js node scripts/test-scheduled-calls.mjs
// Uses an isolated PostgreSQL WASM database. Never connects to production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();let checks=0;
const check=(condition,label)=>{assert.ok(condition,label);checks++;console.log('PASS',label);};
const host='10000000-0000-4000-8000-000000000001',guest='10000000-0000-4000-8000-000000000002',stranger='10000000-0000-4000-8000-000000000003';
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema cron;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;create function cron.schedule(text,text,text) returns int language sql as $$select 1$$;create table public.profiles(id uuid primary key,display_name text);create table public.contacts(user_id uuid,contact_user_id uuid,is_blocked boolean not null default false);`);
 const old=fs.readFileSync('supabase/migrations/20260110032750_1027a5bb-8adb-4f5b-8bc9-c50a464b17c9.sql','utf8');
 await db.exec(old.slice(old.indexOf('CREATE TABLE public.scheduled_calls'),old.indexOf('-- Create call statistics table')));
 await db.exec(`alter table public.scheduled_calls enable row level security;alter table public.scheduled_call_invites enable row level security;grant select,insert,update,delete on public.scheduled_calls,public.scheduled_call_invites to authenticated;create policy own_calls on public.scheduled_calls for select to authenticated using(organizer_id=auth.uid());create policy own_invites on public.scheduled_call_invites for select to authenticated using(user_id=auth.uid());`);
 await db.exec(fs.readFileSync('supabase/migrations/20261025022806_scheduled_call_workflow.sql','utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[host,guest,stranger]);
 await db.query("insert into public.profiles values($1,'Host'),($2,'Guest'),($3,'Other');",[host,guest,stranger]);
 await db.query('insert into public.contacts(user_id,contact_user_id) values($1,$2)',[host,guest]);
 const as=async actor=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor||'']);await db.exec('set role authenticated');};
 const rpc=async(action,id=null,payload={})=>(await db.query('select public.scheduled_call_action($1,$2,$3::jsonb) as result',[action,id,JSON.stringify(payload)])).rows[0].result;
 const fail=async(task,message)=>{await assert.rejects(task,e=>e.message.includes(message));checks++;console.log('PASS rejects',message);};
 const input={title:'Test',call_type:'video',scheduled_at:new Date(Date.now()+5*60000).toISOString(),timezone:'Africa/Luanda',duration_minutes:60,occurrences:1,waiting_room_enabled:true,invitees:[guest],request_id:crypto.randomUUID()};
 await as(null);await fail(()=>rpc('list'),'unauthenticated');
 await as(host);const {id}=await rpc('create',null,input);check(!!id,'atomic create returns id');
 check((await rpc('create',null,input)).id===id,'retry uses idempotency key');
 await fail(()=>rpc('create',null,{...input,title:'Different'}),'request_conflict');
 check((await rpc('list')).length===1,'retry does not create duplicate');
 await fail(()=>rpc('create',null,{...input,request_id:crypto.randomUUID(),invitees:[stranger]}),'contact_required');
 await fail(()=>rpc('create',null,{...input,request_id:crypto.randomUUID(),scheduled_at:'2000-01-01'}),'invalid_date');
 await as(guest);check((await rpc('list')).some(c=>c.id===id),'invitee can list');
 check((await db.query('select id from public.scheduled_calls where id=$1',[id])).rows.length===1,'fixed RLS gives invitee access');
 await fail(()=>rpc('edit',id,{...input,revision:1}),'organizer_required');
 await fail(()=>rpc('start',id),'organizer_required');
 await rpc('rsvp',id,{status:'accepted'});check((await rpc('detail',id)).invitees[0].rsvp_status==='accepted','RSVP persisted');
 await as(stranger);await fail(()=>rpc('detail',id),'not_allowed');await fail(()=>rpc('join',id),'not_allowed');
 await as(host);await rpc('edit',id,{...input,revision:1,title:'Edited'});check((await rpc('detail',id)).revision===2,'edit confirmed revision');
 await fail(()=>rpc('edit',id,{...input,revision:1}),'stale_revision');
 await as(guest);check((await rpc('detail',id)).invitees[0].rsvp_status==='pending','edit resets RSVP');
 await fail(()=>rpc('join',id),'not_live');
 await as(host);check((await rpc('start',id)).allowed,'host starts');
 await as(guest);check((await rpc('join',id)).reason==='waiting','guest held in waiting room');
 await fail(()=>rpc('admit',id,{user_id:guest}),'organizer_required');
 await as(host);check((await rpc('detail',id)).invitees[0].waiting,'host sees waiting participant');
 await rpc('admit',id,{user_id:guest});
 await as(guest);check((await rpc('access',id)).allowed,'admission permits token issuance');
 await as(host);await rpc('end',id);await as(guest);await fail(()=>rpc('join',id),'session_closed');
 await as(host);
 const series=await rpc('create',null,{...input,request_id:crypto.randomUUID(),scheduled_at:'2027-01-31T09:00:00Z',timezone:'Europe/Lisbon',recurrence_pattern:'monthly',occurrences:3});
 const rows=(await rpc('list')).filter(c=>c.series_id);check(rows.length===3,'three materialized occurrences');
 check(rows.map(r=>r.scheduled_at.slice(0,10)).join(',')==='2027-01-31,2027-02-28,2027-03-31','monthly anchor survives February');
 check(rows[2].scheduled_at.includes('08:00:00'),'local time survives DST');
 await rpc('cancel',rows[1].id,{series:true});check((await rpc('list')).filter(c=>c.series_id).length===1,'cancel future series preserves earlier occurrence');
 await fail(()=>rpc('create',null,{...input,request_id:crypto.randomUUID(),scheduled_at:'2027-03-27T01:30:00Z',timezone:'Europe/Lisbon',recurrence_pattern:'daily',occurrences:3}),'invalid_dst_time');
 // Force an insert failure after the call is inserted, verifying transaction rollback.
 await db.exec('reset role');await db.exec("create function public.reject_test_invite() returns trigger language plpgsql as $$begin raise exception 'test_invite_failure';end$$;create trigger reject_test_invite before insert on public.scheduled_call_invites for each row execute function public.reject_test_invite();");
 await as(host);const before=(await rpc('list')).length;
 await fail(()=>rpc('create',null,{...input,request_id:crypto.randomUUID()}),'test_invite_failure');check((await rpc('list')).length===before,'failed invite rolls back call');
 await db.exec('reset role');await db.exec('drop trigger reject_test_invite on public.scheduled_call_invites');
 await as(host);const reminder=await rpc('create',null,{...input,request_id:crypto.randomUUID()});
 await db.exec('reset role');await db.exec('select private.scheduled_reminders();select private.scheduled_reminders();');
 check(Number((await db.query("select count(*) n from public.scheduled_call_events where call_id=$1 and kind='reminder'",[reminder.id])).rows[0].n)===2,'one reminder per recipient despite cron retries');
 await as(guest);const events=await rpc('events');const event=events.find(e=>e.call_id===reminder.id&&e.kind==='reminder');check(!!event,'recipient sees reminder');await rpc('ack',event.id);check(!(await rpc('events')).some(e=>e.id===event.id),'ack hides reminder');
 await as(stranger);await fail(()=>rpc('ack',events[0].id),'not_found');
 await fail(()=>db.query('update public.scheduled_calls set title=$1 where id=$2',['Hijack',id]),'permission denied');
 console.log(`${checks} database checks passed`);
}catch(e){console.error({message:e.message,where:e.where,detail:e.detail});process.exitCode=1;}
finally{await db.close();}
