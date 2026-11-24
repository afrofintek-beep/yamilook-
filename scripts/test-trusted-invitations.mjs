import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hash, compare } from 'bcryptjs';
import ts from 'typescript';

const source = await readFile(new URL('../supabase/functions/trusted-invitations/handler.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { createHandler, sha256, validPassword } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const OWNER = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const SESSION = '00000000-0000-4000-8000-000000000003';
const PASS = 'TrustedPass123!';
const hashPassword = password => hash(password, 10);
const JWT = `header.${Buffer.from(JSON.stringify({sub:OWNER,session_id:SESSION})).toString('base64url')}.signature`;

async function fixture() {
  const db = new PGlite();
  try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key default gen_random_uuid(),email text unique,phone text unique,
      raw_user_meta_data jsonb default '{}',raw_app_meta_data jsonb default '{}',
      email_confirmed_at timestamptz,phone_confirmed_at timestamptz,
      encrypted_password varchar,confirmation_token varchar,confirmation_sent_at timestamptz,recovery_token varchar,recovery_sent_at timestamptz,
      email_change_token_current varchar,email_change_token_new varchar,email_change_sent_at timestamptz,
      phone_change_token varchar,phone_change_sent_at timestamptz,
      reauthentication_token varchar,reauthentication_sent_at timestamptz,updated_at timestamptz,
      deleted_at timestamptz,banned_until timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade);
    create table auth.refresh_tokens(id bigint generated always as identity,user_id varchar,session_id uuid references auth.sessions(id) on delete cascade);
    create table auth.one_time_tokens(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id) on delete cascade,token_hash text);
    create table profiles(id uuid primary key references auth.users(id),email text,display_name text not null,username text not null unique,referral_code text unique,referred_by uuid,onboarding_completed boolean default false,account_status text default 'active');
    create unique index profiles_username_normalized_key on profiles(lower(btrim(username)));
    create table user_settings(user_id uuid);
    create table user_roles(user_id uuid,role text);
    create function has_role(uuid,text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_roles where user_id=$1 and role=$2) $$;
    create table account_session_revocations(id bigint generated always as identity,user_id uuid,session_id uuid,revoked_at timestamptz default now());
    create table user_invitations(code text primary key,invited_by uuid,recipient_email text,created_at timestamptz,used_at timestamptz,used_by uuid,expires_at timestamptz,campaign_id uuid);
    create table invitation_campaigns(id uuid);
    create table invitation_campaign_audit(campaign_id uuid,actor_id uuid,action text,details jsonb);
    create table mvp_candidates(id uuid,access_code text,status text,code_used boolean,full_name text,email text);
    create function can_issue_user_invitation(uuid) returns boolean language sql as $$ select public.has_role($1,'admin') $$;
    create function private.campaign_token_authorized(uuid,uuid) returns boolean language sql as $$ select false $$;
    create function private.consume_registration_link(text,uuid,text) returns text language sql as $$ select null::text $$;
    insert into auth.users(id,email) values('${OWNER}','owner@example.com'),('${OTHER}','other@example.com');
    insert into auth.sessions(id,user_id) values('${SESSION}','${OWNER}');
    insert into profiles(id,email,display_name,username,referral_code) values('${OWNER}','owner@example.com','Owner','owner','ABCD1234'),('${OTHER}','other@example.com','Other','other','EFAB1234');
    insert into user_roles values('${OWNER}','admin');
  `);
  // Exercise the CURRENT strict legacy gate, not the earlier permissive migration.
  const legacy = await readFile(new URL('../supabase/migrations/20261107211714_controlled_invitation_campaigns.sql', import.meta.url),'utf8');
  const shared = await readFile(new URL('../supabase/migrations/20261110114612_shared_registration_links.sql', import.meta.url),'utf8');
  const extract = (sql, name) => {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    const bodyStart = sql.indexOf('AS $function$',start) + 'AS $function$'.length;
    const closing = sql.indexOf('$function$',bodyStart);
    const end = sql.indexOf(';',closing) + 1;
    assert.ok(start>=0 && end>start,name);
    return sql.slice(start,end);
  };
  await db.exec(extract(legacy,'validate_legacy_mvp_access_code'));
  await db.exec(extract(shared,'consume_user_invitation_on_signup'));
  await db.exec(`
    create trigger consume_user_invitation_before_signup before insert on auth.users for each row execute function consume_user_invitation_on_signup();
    create function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
    declare referrer uuid;
    begin
      select id into referrer from profiles where referral_code=NEW.raw_user_meta_data->>'access_code' and public.has_role(id,'admin');
      if referrer is null then raise exception 'YAMILOOK_MVP_ONLY'; end if;
      insert into profiles(id,email,display_name,username,referred_by)
      values(NEW.id,NEW.email,coalesce(NEW.raw_user_meta_data->>'display_name',split_part(NEW.email,'@',1)),coalesce(NEW.raw_user_meta_data->>'username','user_'||substr(NEW.id::text,1,8)),referrer);
      insert into user_settings values(NEW.id);
      return NEW;
    end $$;
    create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261123225604_trusted_invitations.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261123230817_trusted_profile_username_guard.sql', import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261124013342_trusted_auth_reservation.sql', import.meta.url),'utf8'));
  let counter = 0;
  const sent = [];
  const attributes = [];
  const defaults = {
    smsReady: false, otpPepper:'test-pepper-only-32-characters-long', ratePepper:'test-rate-pepper-unique',
    async rpc(action,input,actor=null) {
      try { return (await db.query('select public.trusted_invitations_service($1,$2,$3) result',[action,actor,input])).rows[0].result; }
      catch(error) { if(process.env.TRUSTED_TEST_DEBUG) console.error(action,error.message,error.where); throw error; }
    },
    async getUser(jwt) { return jwt===JWT ? {id:OWNER,is_anonymous:false} : null; },
    async createUser(a) {
      attributes.push(a);
      const id=a.id||crypto.randomUUID();
      const providers=['email',...(a.phone?['phone']:[])];
      const appMetadata={provider:providers[0],providers};
      const userMetadata={...(a.user_metadata||{})};
      const passwordHash=await hashPassword(a.password);
      // Match GoTrue v2.198.0: custom ID is present on INSERT; app metadata
      // initially has providers only and both confirmation dates are NULL.
      // Custom app metadata and confirmations happen afterwards, in the same
      // transaction. Confirm also rewrites user metadata from its Go object.
      await db.transaction(async tx=>{
        await tx.query(`insert into auth.users(id,email,phone,raw_user_meta_data,raw_app_meta_data,email_confirmed_at,phone_confirmed_at,encrypted_password)
          values($1,$2,$3,$4,$5,null,null,$6)`,[id,a.email,a.phone?.replace(/^\+/,'')||null,userMetadata,appMetadata,passwordHash]);
        if(a.app_metadata!==undefined && a.app_metadata!==null) {
          await tx.query('update auth.users set raw_app_meta_data=$1 where id=$2',[{...appMetadata,...a.app_metadata},id]);
        }
        if(a.email_confirm) {
          await tx.query("update auth.users set confirmation_token='',email_confirmed_at=now() where id=$1",[id]);
          userMetadata.email_verified=true;
          await tx.query('update auth.users set raw_user_meta_data=$1 where id=$2',[userMetadata,id]);
          await tx.query('delete from auth.one_time_tokens where user_id=$1',[id]);
        }
        if(a.phone_confirm) {
          await tx.query("update auth.users set confirmation_token='',phone_confirmed_at=now() where id=$1",[id]);
          await tx.query('delete from auth.one_time_tokens where user_id=$1',[id]);
        }
      });
      return {id};
    },
    async signIn(identifier,password) {
      const u=(await db.query('select * from auth.users where email=$1',[identifier])).rows[0];
      const valid=await compare(password,u?.encrypted_password||'$2b$10$K9EHKy7A5cEzo8XeJlKWmeQWDC72M5tP9S3tPvNwdOmeD6EGi8jvK');
      if(!u || !valid || !u.email_confirmed_at || u.deleted_at || (u.banned_until && new Date(u.banned_until)>new Date()))return null;
      const sid=crypto.randomUUID();
      await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid,u.id]);
      await db.query('insert into auth.refresh_tokens(user_id,session_id) values($1,$2)',[u.id,sid]);
      return {access_token:`synthetic-access-${++counter}`,refresh_token:`synthetic-refresh-${counter}`,
        user:{id:u.id,email:u.email,app_metadata:u.raw_app_meta_data,user_metadata:u.raw_user_meta_data},session_id:sid};
    },
    hashPassword,
    async sendSms(phone,otp) { sent.push({phone,otp});return true; },
  };
  const ports={...defaults};
  const handler=createHandler(ports);
  const call=async(action,input={},admin=false) => {
    const res=await handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json','x-real-ip':'192.0.2.1',...(admin?{Authorization:`Bearer ${JWT}`}:{})},body:JSON.stringify({action,...input})}));
    return {status:res.status,body:await res.json()};
  };
  const issue=async(input={}) => {
    const r=await call('issue',{mode:'direct',recipient_name:'Synthetic contact',language:'pt',...input},true);
    assert.equal(r.status,200,JSON.stringify(r.body)); return r.body;
  };
  const activate=(token,username,extra={}) => call('activate',{token,username,display_name:'Synthetic contact',password:PASS,accepted_terms:true,...extra});
  return {db,ports,defaults,sent,attributes,call,issue,activate,close:()=>db.close()};
  } catch(error) { await db.close(); throw error; }
}

test('trusted direct invitations: strict admin issuance, non-consuming preview, single activation and native password credentials', async()=>{
  const f=await fixture();
  try {
    assert.equal((await f.call('status')).status,401);
    const status=await f.call('status',{},true);assert.equal(status.body.sms_ready,false,JSON.stringify(status));
    const inv=await f.issue({language:'fr'});
    assert.match(inv.token,/^[a-f0-9]{64}$/); assert.ok(inv.link.endsWith(`#trusted=${inv.token}`));
    for(let n=0;n<2;n++) assert.equal((await f.call('preview',{token:inv.token})).body.invitation.status,'pending');
    const row=(await f.db.query('select * from private.trusted_invitations')).rows[0];
    assert.equal(row.used_at,null); assert.equal(row.token_hash,await sha256(inv.token));
    assert.ok(!JSON.stringify(row).includes(inv.token));
    assert.equal(Math.round((new Date(row.expires_at)-new Date(row.created_at))/3600000),72);
    const noTerms=await f.activate(inv.token,'trusted_person',{accepted_terms:false});assert.equal(noTerms.body.error.code,'terms_required');
    const activated=await f.activate(inv.token,'trusted_person');
    assert.equal(activated.status,200,JSON.stringify(activated));
    assert.equal(activated.body.account_created,true);assert.match(activated.body.recovery_code,/^[a-f0-9]{64}$/);
    const id=activated.body.session.user.id;
    assert.equal(f.attributes[0].id,id);
    assert.equal(Object.hasOwn(f.attributes[0],'app_metadata'),false);
    const user=(await f.db.query('select * from auth.users where id=$1',[id])).rows[0];
    assert.match(user.email,/^[a-f0-9]{32}@trusted-login\.yamilook\.invalid$/);
    assert.equal(user.raw_app_meta_data.trusted_account,true);
    assert.equal(user.raw_app_meta_data.contact_email_verified,false);
    assert.equal(user.raw_app_meta_data.trusted_claim_hash,undefined);
    assert.equal(user.raw_app_meta_data.trusted_recovery_hash,undefined);
    assert.equal(activated.body.session.user.app_metadata.trusted_account,true);
    assert.equal(user.raw_user_meta_data.registration_email_language,'fr');
    assert.equal(user.raw_user_meta_data.ref,undefined); // GoTrue Confirm rewrites from its original model.
    assert.equal(user.raw_user_meta_data.email_verified,true); // Internal identifier only.
    const reservation=(await f.db.query('select activation_claim_hash,activation_recovery_hash from private.trusted_invitations where id=$1',[inv.invitation.id])).rows[0];
    for(const secret of [reservation.activation_claim_hash,reservation.activation_recovery_hash]) {
      assert.ok(!JSON.stringify({app:user.raw_app_meta_data,user:user.raw_user_meta_data}).includes(secret));
    }
    assert.ok(!JSON.stringify(user).includes(activated.body.recovery_code));
    const profile=(await f.db.query('select * from profiles where id=$1',[id])).rows[0];
    assert.equal(profile.email,null);assert.equal(profile.onboarding_completed,false);
    assert.equal(profile.referred_by,OWNER);
    assert.equal(profile.username,'trusted_person');
    assert.equal((await f.call('login',{username:'trusted_person',password:PASS})).status,200);
    const wrong=await f.call('login',{username:'trusted_person',password:'WrongPassword123!'});
    const unknown=await f.call('login',{username:'not_a_user',password:'WrongPassword123!'});
    assert.deepEqual(wrong.body,unknown.body); assert.equal(wrong.status,401);
    assert.equal((await f.activate(inv.token,'different_person')).body.error.code,'invalid_invitation');
    assert.equal((await f.call('preview',{token:inv.token})).body.error.code,'invalid_invitation');
    const list=(await f.call('list',{},true)).body.invitations;
    assert.equal(list[0].status,'used');assert.ok(!JSON.stringify(list).includes(inv.token));assert.ok(!JSON.stringify(list).includes(row.token_hash));
    assert.equal((await f.call('revoke',{id:inv.invitation.id},true)).body.error.code,'already_used');
  } finally {await f.close();}
});

test('native Auth reservations bind UUID, internal alias and username; forged metadata and expired claims cannot consume an invitation',async()=>{
  const f=await fixture();
  try {
    await assert.rejects(f.defaults.createUser({id:crypto.randomUUID(),email:'f'.repeat(32)+'@trusted-login.yamilook.invalid',
      password:PASS,email_confirm:true,user_metadata:{username:'forged_person',display_name:'Forged',access_code:'ABCD1234',
        trusted_signup_version:1,trusted_claim_hash:'a'.repeat(64),trusted_recovery_hash:'b'.repeat(64)},
      app_metadata:{trusted_signup_version:1,trusted_claim_hash:'a'.repeat(64),trusted_recovery_hash:'b'.repeat(64)}}),/TRUSTED_INVITE_INVALID/);
    assert.equal((await f.db.query('select count(*)::int n from private.trusted_accounts')).rows[0].n,0);

    const mutations=[
      ['uuid',async a=>({...a,id:crypto.randomUUID()})],
      ['alias',async a=>({...a,email:'e'.repeat(32)+'@trusted-login.yamilook.invalid'})],
      ['real_email',async a=>({...a,email:'not-a-verified-mailbox@example.com'})],
      ['username',async a=>({...a,user_metadata:{...a.user_metadata,username:'unbound_person'}})],
      ['expired',async a=>{await f.db.query("update private.trusted_invitations set activation_expires_at=now()-interval '1 second' where activation_user_id=$1",[a.id]);return a;}],
    ];
    for(const [label,mutate] of mutations) {
      const inv=await f.issue();
      f.ports.createUser=async a=>f.defaults.createUser(await mutate(a));
      const rejected=await f.activate(inv.token,`reserved_${label}`);
      assert.equal(rejected.status,503,`${label}: ${JSON.stringify(rejected)}`);
      const pending=(await f.db.query('select used_at,activation_claim_hash,activation_user_id,activation_identifier,activation_recovery_hash from private.trusted_invitations where id=$1',[inv.invitation.id])).rows[0];
      assert.deepEqual(pending,{used_at:null,activation_claim_hash:null,activation_user_id:null,activation_identifier:null,activation_recovery_hash:null});
      f.ports.createUser=f.defaults.createUser;
      const accepted=await f.activate(inv.token,`reserved_${label}`);
      assert.equal(accepted.status,200,`${label}: ${JSON.stringify(accepted)}`);
      await assert.rejects(f.defaults.createUser(f.attributes.at(-1)),/TRUSTED_INVITE_INVALID/);
    }

    const inv=await f.issue();
    const existing=await f.ports.rpc('prepare_activation',{token_hash:await sha256(inv.token),username:'unused_name',
      user_id:OWNER,identifier:'d'.repeat(32)+'@trusted-login.yamilook.invalid',recovery_hash:'c'.repeat(64),claim_hash:'b'.repeat(64)});
    assert.equal(existing.error.code,'invalid_request');
    assert.equal((await f.db.query('select used_at from private.trusted_invitations where id=$1',[inv.invitation.id])).rows[0].used_at,null);
  } finally {await f.close();}
});

test('trusted signup cannot be forged in public metadata; revocation, expiry, admin removal and username races fail closed',async()=>{
  const f=await fixture();
  try {
    const inv=await f.issue();
    await assert.rejects(f.db.query(`insert into auth.users(email,raw_user_meta_data,email_confirmed_at) values($1,$2,now())`,
      ['a'.repeat(32)+'@trusted-login.yamilook.invalid',{trusted_signup_version:1,access_code:'ABCD1234'}]),/TRUSTED_INVITE_INVALID/);
    await f.call('revoke',{id:inv.invitation.id},true);
    assert.equal((await f.activate(inv.token,'revoked_person')).body.error.code,'invalid_invitation');
    const expired=await f.issue();
    await f.db.query("update private.trusted_invitations set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id=$1",[expired.invitation.id]);
    assert.equal((await f.activate(expired.token,'expired_person')).body.error.code,'invalid_invitation');
    const removed=await f.issue();
    await f.db.query("delete from user_roles where user_id=$1",[OWNER]);
    assert.equal((await f.activate(removed.token,'removed_person')).body.error.code,'invalid_invitation');
    await f.db.query("insert into user_roles values($1,'admin')",[OWNER]);
    await f.db.query("update profiles set account_status='suspended' where id=$1",[OWNER]);
    assert.equal((await f.call('status',{},true)).body.error.code,'forbidden');
    assert.equal((await f.activate(removed.token,'suspended_person')).body.error.code,'invalid_invitation');
    await f.db.query("update profiles set account_status='active' where id=$1",[OWNER]);
    assert.equal((await f.activate(removed.token,'owner')).body.error.code,'username_unavailable');
    const race=await f.issue();
    f.ports.createUser=async attributes=>{
      await f.db.query('update private.trusted_invitations set revoked_at=now() where id=$1',[race.invitation.id]);
      return f.defaults.createUser(attributes);
    };
    assert.equal((await f.activate(race.token,'race_person')).status,503);
    assert.equal((await f.db.query('select count(*)::int n from private.trusted_accounts')).rows[0].n,0);
    await f.db.exec('set role anon');
    await assert.rejects(f.db.query("select public.trusted_invitations_service('list',null,'{}')"),/permission denied/);
    await f.db.exec('reset role;set role authenticated');
    await assert.rejects(f.db.query("select public.trusted_invitations_service('list',null,'{}')"),/permission denied/);
    await f.db.exec('reset role');
    await f.db.exec('set role service_role');
    assert.equal((await f.ports.rpc('status',{session_id:SESSION},OWNER)).ok,true);
    await f.db.exec('reset role');
  } finally {await f.close();}
});

test('trusted profile username updates preserve login and reject unrepresentable identifiers without restricting legacy accounts',async()=>{
  const f=await fixture();
  try {
    const inv=await f.issue(),created=await f.activate(inv.token,'trusted_rename');
    assert.equal(created.status,200,JSON.stringify(created));
    const uid=created.body.session.user.id;
    const permissions=(await f.db.query(`select
      has_function_privilege('anon','private.trusted_profile_username_guard()','EXECUTE') anon_execute,
      has_function_privilege('authenticated','private.trusted_profile_username_guard()','EXECUTE') authenticated_execute`)).rows[0];
    assert.deepEqual(permissions,{anon_execute:false,authenticated_execute:false});
    // Exercise the trigger with a browser role that cannot read private accounts.
    await f.db.exec('grant select(id,username),update(username) on public.profiles to authenticated;set role authenticated');
    for(const invalid of ['nome.apelido','nome apelido','@nome','_nome','ab','n'.repeat(21),'nomé',null]) {
      await assert.rejects(f.db.query('update public.profiles set username=$1 where id=$2',[invalid,uid]),
        error=>error.code==='23514' && error.message==='TRUSTED_USERNAME_INVALID');
    }
    assert.equal((await f.db.query('select username from public.profiles where id=$1',[uid])).rows[0].username,'trusted_rename');
    await f.db.exec('reset role');
    assert.equal((await f.call('login',{username:'trusted_rename',password:PASS})).status,200);

    await f.db.exec('set role authenticated');
    await f.db.query('update public.profiles set username=$1 where id=$2',['  Allowed_Name  ',uid]);
    assert.equal((await f.db.query('select username from public.profiles where id=$1',[uid])).rows[0].username,'  Allowed_Name  ');
    for(const legacyName of ['nome.apelido','nome apelido']) {
      await f.db.query('update public.profiles set username=$1 where id=$2',[legacyName,OTHER]);
      assert.equal((await f.db.query('select username from public.profiles where id=$1',[OTHER])).rows[0].username,legacyName);
    }
    await f.db.exec('reset role');
    assert.equal((await f.call('login',{username:'allowed_name',password:PASS})).status,200);
    const recovered=await f.call('recover',{username:'allowed_name',recovery_code:created.body.recovery_code,new_password:'RenamedTrustedPass123!'});
    assert.equal(recovered.status,200,JSON.stringify(recovered));
  } finally {await f.close();}
});

test('trusted recovery rotates one-time code, native bcrypt password and all sessions atomically; current username is authoritative',async()=>{
  const f=await fixture();
  try {
    const inv=await f.issue(),created=await f.activate(inv.token,'recover_person');
    assert.equal(created.status,200,JSON.stringify(created));
    const uid=created.body.session.user.id,originalCode=created.body.recovery_code;
    await f.db.query(`update auth.users set confirmation_token='pending-confirm',confirmation_sent_at=now(),
      recovery_token='pending-recovery',recovery_sent_at=now(),email_change_token_current='pending-current',
      email_change_token_new='pending-new',email_change_sent_at=now(),phone_change_token='pending-phone',
      phone_change_sent_at=now(),reauthentication_token='pending-reauth',reauthentication_sent_at=now() where id=$1`,[uid]);
    await f.db.query("insert into auth.one_time_tokens(user_id,token_hash) values($1,'pending-trusted'),($2,'unrelated-owner')",[uid,OWNER]);
    const identityBefore=(await f.db.query('select email,phone from auth.users where id=$1',[uid])).rows[0];
    await f.call('login',{username:'recover_person',password:PASS});
    const sessionsBefore=(await f.db.query('select count(*)::int n from auth.sessions where user_id=$1',[uid])).rows[0].n;
    assert.equal(sessionsBefore,2);
    await f.db.query("update profiles set username='Renamed_Person' where id=$1",[uid]);
    assert.equal((await f.call('login',{username:'recover_person',password:PASS})).status,401);
    assert.equal((await f.call('login',{username:'renamed_person',password:PASS})).status,200);
    const wrong=await f.call('recover',{username:'renamed_person',recovery_code:'f'.repeat(64),new_password:'NewTrustedPass123!'});
    const unknown=await f.call('recover',{username:'missing_person',recovery_code:'f'.repeat(64),new_password:'NewTrustedPass123!'});
    assert.deepEqual(wrong.body,unknown.body);
    const recovered=await f.call('recover',{username:'renamed_person',recovery_code:originalCode,new_password:'NewTrustedPass123!'});
    assert.equal(recovered.status,200,JSON.stringify(recovered));assert.notEqual(recovered.body.recovery_code,originalCode);
    assert.equal(recovered.body.session,undefined);
    const row=(await f.db.query('select * from auth.users where id=$1',[uid])).rows[0];
    assert.deepEqual({email:row.email,phone:row.phone},identityBefore);
    for(const column of ['confirmation_token','recovery_token','email_change_token_current','email_change_token_new','phone_change_token','reauthentication_token']) {
      assert.equal(row[column],'',column);
    }
    for(const column of ['confirmation_sent_at','recovery_sent_at','email_change_sent_at','phone_change_sent_at','reauthentication_sent_at']) {
      assert.equal(row[column],null,column);
    }
    assert.equal((await f.db.query('select count(*)::int n from auth.one_time_tokens where user_id=$1',[uid])).rows[0].n,0);
    assert.equal((await f.db.query('select count(*)::int n from auth.one_time_tokens where user_id=$1',[OWNER])).rows[0].n,1);
    assert.equal(await compare('NewTrustedPass123!',row.encrypted_password),true);
    assert.equal(await compare(PASS,row.encrypted_password),false);
    assert.equal((await f.db.query('select count(*)::int n from auth.sessions where user_id=$1',[uid])).rows[0].n,0);
    assert.equal((await f.db.query('select count(*)::int n from auth.refresh_tokens where user_id=$1',[uid])).rows[0].n,0);
    assert.equal((await f.db.query('select count(*)::int n from account_session_revocations where user_id=$1',[uid])).rows[0].n,3);
    assert.equal((await f.call('recover',{username:'renamed_person',recovery_code:originalCode,new_password:PASS})).body.error.code,'invalid_recovery');
    assert.equal((await f.call('login',{username:'renamed_person',password:'NewTrustedPass123!'})).status,200);
    await f.db.query("update profiles set account_status='suspended' where id=$1",[uid]);
    assert.equal((await f.call('recover',{username:'renamed_person',recovery_code:recovered.body.recovery_code,new_password:PASS})).body.error.code,'invalid_recovery');
    assert.equal((await f.call('login',{username:'renamed_person',password:'NewTrustedPass123!'})).status,401);
    await f.db.query("update profiles set account_status='active' where id=$1",[uid]);
    await f.db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1",[uid]);
    assert.equal((await f.call('recover',{username:'renamed_person',recovery_code:recovered.body.recovery_code,new_password:PASS})).body.error.code,'invalid_recovery');
    assert.equal((await f.call('login',{username:'renamed_person',password:'NewTrustedPass123!'})).status,401);
    assert.equal((await f.call('recover',{username:'owner',recovery_code:recovered.body.recovery_code,new_password:PASS})).body.error.code,'invalid_recovery');
  } finally {await f.close();}
});

test('phone invitations remain configuration-gated; bound SMS OTP expires, limits guesses and is never a client-selectable destination',async()=>{
  const f=await fixture();
  try {
    const unavailable=await f.call('issue',{mode:'phone',phone:'+244923000001',recipient_name:'Synthetic'},true);
    assert.equal(unavailable.body.error.code,'sms_unavailable');
    f.ports.smsReady=true;
    const inv=await f.issue({mode:'phone',phone:'+244923000001'});
    const preview=await f.call('preview',{token:inv.token});
    assert.ok(preview.body.invitation.masked_phone);assert.ok(!JSON.stringify(preview.body).includes('+244923000001'));
    const requested=await f.call('request_otp',{token:inv.token,phone:'+244923999999'});
    assert.equal(requested.status,200,JSON.stringify(requested));assert.equal(f.sent[0].phone,'+244923000001');
    assert.equal((await f.call('request_otp',{token:inv.token})).body.error.code,'rate_limited');
    const otp=f.sent[0].otp;
    const wrong=otp==='000000'?'111111':'000000';
    for(let n=0;n<5;n++) assert.equal((await f.activate(inv.token,'phone_person',{otp:wrong})).body.error.code,'invalid_otp');
    assert.equal((await f.activate(inv.token,'phone_person',{otp})).body.error.code,'invalid_otp');
    const attempts=(await f.db.query('select otp_attempts from private.trusted_invitations where id=$1',[inv.invitation.id])).rows[0].otp_attempts;
    assert.equal(attempts,5);
    const valid=await f.issue({mode:'phone',phone:'+244923000002'});
    await f.call('request_otp',{token:valid.token});
    const created=await f.activate(valid.token,'phone_valid',{otp:f.sent.at(-1).otp});
    assert.equal(created.status,200,JSON.stringify(created));
    const u=(await f.db.query('select phone,phone_confirmed_at from auth.users where id=$1',[created.body.session.user.id])).rows[0];
    assert.equal(u.phone,'244923000002');assert.ok(u.phone_confirmed_at);
    const expired=await f.issue({mode:'phone',phone:'+244923000003'});
    await f.call('request_otp',{token:expired.token});
    await f.db.query("update private.trusted_invitations set otp_expires_at=now()-interval '1 second' where id=$1",[expired.invitation.id]);
    assert.equal((await f.activate(expired.token,'phone_expired',{otp:f.sent.at(-1).otp})).body.error.code,'invalid_otp');
    const replaced=await f.issue({mode:'phone',phone:'+244923000004'});
    await f.call('request_otp',{token:replaced.token});
    const priorOtp=f.sent.at(-1).otp;
    f.ports.createUser=async a=>{
      await f.db.query("update private.trusted_invitations set otp_sent_at=now()-interval '2 minutes' where id=$1",[replaced.invitation.id]);
      assert.equal((await f.call('request_otp',{token:replaced.token})).status,200);
      return f.defaults.createUser(a);
    };
    assert.equal((await f.activate(replaced.token,'phone_replaced',{otp:priorOtp})).status,503);
    assert.equal((await f.db.query('select used_at from private.trusted_invitations where id=$1',[replaced.invitation.id])).rows[0].used_at,null);
    f.ports.createUser=f.defaults.createUser;
    assert.equal((await f.activate(replaced.token,'phone_replaced',{otp:f.sent.at(-1).otp})).status,200);
  } finally {await f.close();}
});

test('ambiguous Auth create response is reconciled, and failed login/activation/recovery attempts remain rate-limited',async()=>{
  const f=await fixture();
  try {
    const inv=await f.issue();
    f.ports.createUser=async attributes=>{await f.defaults.createUser(attributes);return null;};
    const created=await f.activate(inv.token,'ambiguous_person');
    assert.equal(created.status,200,JSON.stringify(created));assert.ok(created.body.recovery_code);
    f.ports.createUser=f.defaults.createUser;
    const concurrent=await f.issue();
    const outcomes=await Promise.all([f.activate(concurrent.token,'concurrent_one'),f.activate(concurrent.token,'concurrent_two')]);
    assert.equal(outcomes.filter(x=>x.status===200).length,1);
    assert.equal((await f.db.query('select count(*)::int n from private.trusted_accounts')).rows[0].n,2);
    const key=await sha256('synthetic-limit');
    assert.equal((await f.ports.rpc('rate',{key,limit:2,window_seconds:60})).ok,true);
    assert.equal((await f.ports.rpc('rate',{key,limit:2,window_seconds:60})).ok,true);
    assert.equal((await f.ports.rpc('rate',{key,limit:2,window_seconds:60})).ok,false);
    assert.equal((await f.db.query('select attempts from private.trusted_invitation_limits where key=$1',[key])).rows[0].attempts,3);
    assert.equal(validPassword('Short123!'),false);
    assert.equal(validPassword('é'.repeat(34)+'Abc123'),false);
    assert.equal(validPassword(PASS),true);
    await f.db.exec("update private.trusted_invitation_limits set window_at=now()-interval '2 days'");
    await f.ports.rpc('rate',{key:await sha256('fresh-limit'),limit:2,window_seconds:60});
    assert.equal((await f.db.query("select count(*)::int n from private.trusted_invitation_limits where window_at<now()-interval '1 day'")).rows[0].n,0);
  } finally {await f.close();}
});
