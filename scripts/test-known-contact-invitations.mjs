import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('known contact authorization, policy race, single use and audit', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const outsider = '00000000-0000-4000-8000-000000000002';
  const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const migration = async suffix => {
    const files = await readdir(new URL('../supabase/migrations/', import.meta.url));
    return readFile(new URL('../supabase/migrations/' + files.find(f => f.endsWith(suffix)), import.meta.url), 'utf8');
  };
  const actor = async id => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  const issue = async n => (await db.query('select issue_shareable_user_invitation($1) as invite', [uuid(n)])).rows[0].invite;
  const valid = async code => (await db.query('select validate_mvp_access_code($1) as result', [code])).rows[0].result;
  const signup = async (code, email, n) => {
    await db.exec('reset role');
    return db.query('insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3) returning raw_user_meta_data', [uuid(n), email, { access_code: code }]);
  };
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to authenticated;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
      create table profiles(id uuid primary key,email text,referral_code text,display_name text);
      create table mvp_candidates(id uuid,access_code text,status text,code_used boolean,full_name text,email text);
      create function has_role(uuid,text) returns boolean language sql stable as $$ select $1 = '${owner}'::uuid $$;
      create function validate_mvp_access_code(text) returns json language sql as $$ select '{"valid":false}'::json $$;
      insert into profiles values('${owner}','owner@example.com','ABCD1234','Owner'),('${outsider}','other@example.com','EFAB1234','Other');`);
    await db.exec(await migration('_single_use_invitations.sql'));
    await db.exec(await migration('_mvp_invitation_permissions.sql'));
    await db.exec(await migration('_shareable_contact_invitations.sql'));

    await db.exec(`create schema private;
      create function private.invitation_require_admin() returns void language plpgsql as $$
      begin if auth.uid() is null or not public.has_role(auth.uid(),'admin') then
      raise exception 'admin required'; end if; end $$;
      alter table user_invitations add column campaign_id uuid;
      alter table auth.users add column raw_app_meta_data jsonb, add column email_confirmed_at timestamptz;
      alter table auth.users disable trigger consume_user_invitation_before_signup;
      insert into auth.users(id,email) values('${owner}','owner@example.com');
      alter table auth.users enable trigger consume_user_invitation_before_signup;
    `);
    await db.exec(await migration('_known_contact_invitations.sql'));
    const known = async email => (await db.query("select issue_individual_invitation($1,'admin_waiver') as invite",[email])).rows[0].invite;
    const registerKnown = async (code,email,n) => {
      await db.exec('reset role');
      return db.query(`insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,email_confirmed_at)
       values($1,$2,$3,'{"known_contact_registration":true}',now()) returning raw_app_meta_data`,
       [uuid(n),email,JSON.stringify({access_code:code})]);
    };
    await actor(outsider);
    await assert.rejects(known('friend@example.com'), /admin required/);
    await actor(owner);
    const invite = await known('friend@example.com');
    await assert.rejects(registerKnown(invite.code,'wrong@example.com',500), /outro email/);
    const created = await registerKnown(invite.code,'friend@example.com',501);
    assert.equal(created.rows[0].raw_app_meta_data.email_confirmation_method,'admin_waiver');
    assert.equal(created.rows[0].raw_app_meta_data.invitation_authorized_by,owner);
    await assert.rejects(registerKnown(invite.code,'friend@example.com',502), /já foi utilizado/);
    await actor(owner);
    const changed = await known('changed@example.com');
    await db.query("select issue_individual_invitation($1,'email')",['changed@example.com']);
    await assert.rejects(registerKnown(changed.code,'changed@example.com',503), /exige confirmação/);
    const audit = await db.query('select count(*)::int as n from individual_invitation_authorizations');
    assert.equal(audit.rows[0].n,3);
    await actor(owner);
    const expired = await known('expired@example.com');
    await db.exec('reset role');
    await db.query("update user_invitations set expires_at=now()-interval '1 hour' where code=$1",[expired.code]);
    await assert.rejects(registerKnown(expired.code,'expired@example.com',504), /expirou/);
  } finally { await db.close(); }
});
