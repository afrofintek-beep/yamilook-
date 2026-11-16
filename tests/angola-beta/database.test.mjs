import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('Angola admissions, confirmations, five single-use invitations, privacy and legacy compatibility', async t => {
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 grant usage on schema public,auth to anon,authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz,phone_confirmed_at timestamptz,deleted_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
 create table public.profiles(id uuid primary key,email text,display_name text,username text unique,referred_by uuid,referral_code text default 'LEGACYREF',country_code text,account_status text default 'active',last_seen timestamptz);
 create table public.user_settings(user_id uuid primary key);
 create table public.mvp_candidates(access_code text,status text,code_used boolean);
 create table public.user_invitations(code text primary key,campaign_id uuid,invited_by uuid,used_at timestamptz,used_by uuid,expires_at timestamptz,recipient_email text);
 create table public.invitation_campaigns(id uuid primary key);
 create table public.invitation_campaign_audit(campaign_id uuid,actor_id uuid,action text,details jsonb);
 create function public.has_role(u uuid,r text) returns boolean language sql as $$select u='${id(999)}'::uuid$$;
 create function private.invitation_require_admin() returns void language plpgsql as $$begin if auth.uid() is null or not public.has_role(auth.uid(),'admin') then raise exception 'admin only';end if;end$$;
 create function private.consume_registration_link(c text,u uuid,e text) returns text language sql as $$select null::text$$;
 create function private.validate_registration_link(c text) returns json language sql as $$select null::json$$;
 create function private.campaign_token_authorized(c uuid,u uuid) returns boolean language sql as $$select true$$;
 create function public.can_issue_user_invitation(u uuid) returns boolean language sql as $$select true$$;
 create function public.validate_legacy_mvp_access_code(c text) returns json language sql as $$select json_build_object('valid',c='LEGACYREF')$$;
 `);
 await db.exec(await readFile('tests/angola-beta/legacy-auth.sql','utf8'));
 await db.exec(`create trigger consume_user_invitation_before_signup before insert on auth.users for each row execute function public.consume_user_invitation_on_signup();
 create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();`);
 await db.exec("insert into public.mvp_candidates values('LEGACYREF','approved',false)");
 const signup=async(n,meta={},confirmed=false)=> db.query(`insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at) values($1,$2,$3,case when $4 then now() end)`,[id(n),`person${n}@example.test`,{username:`person${n}`,...meta},confirmed]);
 const call=async(action,payload={})=>(await db.query('select public.angola_beta($1,$2) as data',[action,payload])).rows[0].data;
 await signup(1,{access_code:'LEGACYREF'},true); await db.exec(`update profiles set country_code='AO';`);
 await db.exec(await readFile('supabase/migrations/20261116021257_angola_10000_banda_invites.sql','utf8'));
 await db.exec(`update private.angola_beta_config set enabled=true;`);
 const meta=(code='')=>({access_code:code,onboarding_draft:{country:'AO'}});
 await t.test('backfill and public aggregate only',async()=>{
  const status=await call('status');assert.equal(status.confirmed,1);assert.equal(status.capacity,10000);
  assert.equal((await db.query('select count(*)::int n from private.angola_beta_invites')).rows[0].n,5);
  await db.exec('set role anon');assert.equal((await call('status')).confirmed,1);
  await assert.rejects(db.exec('select * from private.angola_beta_members'),/permission denied/);
  await assert.rejects(call('report'),/Autenticação/);await db.exec('reset role');
 });
 await t.test('open signup creates profile, settings and reservation, no unconfirmed invitations',async()=>{
  await signup(2,meta());assert.equal((await call('status')).confirmed,1);assert.equal((await call('status')).available,9998);
  const p=(await db.query('select * from profiles where id=$1',[id(2)])).rows[0];assert.equal(p.country_code,'AO');
  assert.equal((await db.query('select count(*)::int n from user_settings where user_id=$1',[id(2)])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from private.angola_beta_invites where owner_id=$1',[id(2)])).rows[0].n,0);
 });
 await t.test('confirmation grants exactly five, repeated calls and confirmation updates never add more',async()=>{
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id(2)]);
  await db.query("select set_config('test.uid',$1,false)",[id(2)]);
  for(let n=0;n<3;n++)assert.equal((await call('mine')).invites.length,5);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[id(2)]);
  assert.equal((await call('mine')).invites.length,5);assert.equal((await call('status')).confirmed,2);
 });
 const invites=(await call('mine')).invites;
 await t.test('single use, attribution, next generation and invalid country',async()=>{
  await assert.rejects(signup(3,{access_code:invites[0].code,onboarding_draft:{country:'PT'}}),/ANGOLA_ONLY/);
  await signup(3,meta(invites[0].code),true);
  assert.equal((await db.query('select referred_by from profiles where id=$1',[id(3)])).rows[0].referred_by,id(2));
  assert.equal((await db.query('select count(*)::int n from private.angola_beta_invites where owner_id=$1',[id(3)])).rows[0].n,5);
  await assert.rejects(signup(4,meta(invites[0].code)),/ANGOLA_INVITE_UNAVAILABLE/);
 });
 await t.test('failure in downstream profile creation rolls back reservation and invitation',async()=>{
  const before=(await call('status')).available;
  await assert.rejects(signup(4,{...meta(invites[1].code),username:'person1'}),/unique/);
  assert.equal((await call('status')).available,before);assert.equal((await call('check',{code:invites[1].code})).valid,true);
 });
 await t.test('forged identity metadata cannot authorize signup or obtain someone else invitations',async()=>{
  await assert.rejects(signup(4,{country:'AO',confirmed:true,beta_member:true}),/MVP_ONLY/);
  await db.query("select set_config('test.uid',$1,false)",[id(3)]);
  const mine=await call('mine',{user_id:id(2)});assert.ok(mine.invites.every(i=>!invites.some(j=>j.code===i.code)));
  await assert.rejects(call('configure',{enabled:false}),/admin only/);
 });
 await t.test('legacy non-Angola registration remains compatible',async()=>{
  await signup(5,{access_code:'LEGACYREF',username:'legacy-five'},true);
  assert.equal((await db.query('select count(*)::int n from profiles where id=$1',[id(5)])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::int n from private.angola_beta_members where user_id=$1',[id(5)])).rows[0].n,0);
 });
 await t.test('cap serializes attempts and cannot be bypassed by an invitation or old code',async()=>{
  await db.exec('update private.angola_beta_config set capacity=4');
  const results=await Promise.allSettled(Array.from({length:8},(_,n)=>signup(10+n,{...meta(),username:`cap${n}`})));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal((await call('status')).available,0);
  await assert.rejects(signup(25,meta(invites[2].code)),/ANGOLA_FULL/);
  await assert.rejects(signup(26,meta('LEGACYREF')),/ANGOLA_FULL/);
 });
 await t.test('waitlist consent/idempotency and feedback throttling',async()=>{
  await db.exec('set role anon');await assert.rejects(call('waitlist',{email:'a@example.test'}),/Confirma/);
  await call('waitlist',{email:'a@example.test',consent:true});await call('waitlist',{email:'a@example.test',consent:true});
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from private.angola_beta_waitlist')).rows[0].n,1);
  for(let n=0;n<5;n++)await call('feedback',{message:'Test problem details'});
  await assert.rejects(call('feedback',{message:'Test problem details'}),/cinco mensagens/);
 });
 await t.test('pause and expiry prevent new cohort signups without deleting existing accounts',async()=>{
  await db.exec('update private.angola_beta_config set enabled=false,capacity=10000');
  await assert.rejects(signup(30,meta()),/ANGOLA_CLOSED/);
  assert.equal((await call('mine')).eligible,true);
  await db.exec("update private.angola_beta_config set enabled=true,ends_at=now()-interval '1 second'");
  await assert.rejects(signup(31,meta(invites[2].code)),/ANGOLA_CLOSED/);
 });
 await db.close();
});
