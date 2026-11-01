import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';

test('contact invitation authorization, expiry, atomic redemption and legacy compatibility', async () => {
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
    await db.exec('set role anon');
    await assert.rejects(issue(10), /permission denied/);
    await actor(outsider);
    await assert.rejects(issue(10), /autorizada/);
    await actor(owner);
    await assert.rejects(db.exec('select issue_shareable_user_invitation(null)'), /inválido/);
    const first = await issue(10);
    assert.match(first.code, /^[A-F0-9]{16}$/);
    assert.deepEqual(await issue(10), first, 'network retry returns same invitation');
    assert.ok(new Date(first.expires_at) > new Date());
    assert.equal((await valid(first.code)).valid, true);
    const second = await issue(11);
    assert.notEqual(second.code, first.code, 'different contact gets different invitation');
    await actor(outsider);
    assert.equal((await db.query('select * from user_invitations')).rows.length, 0, 'RLS hides others invitations');
    await assert.rejects(db.query('update user_invitations set recipient_email=$1', ['hijack@example.com']), /permission denied/);
    await signup(first.code, 'New@Example.com', 100);
    const audit = (await db.query('select * from user_invitations where code=$1', [first.code])).rows[0];
    assert.equal(audit.recipient_email, 'new@example.com');
    assert.equal(audit.used_by, uuid(100));
    assert.ok(audit.used_at);
    assert.equal((await valid(first.code)).valid, false);
    await assert.rejects(signup(first.code, 'again@example.com', 101), /já foi utilizado/);
    await actor(owner);
    await assert.rejects(issue(10), /novo convite/);
    // A failed transaction must not consume the invitation.
    await db.exec('reset role; begin');
    await signup(second.code, 'rollback@example.com', 102);
    await db.exec('rollback; reset role');
    assert.equal((await valid(second.code)).valid, true);
    await db.query("update user_invitations set expires_at=now()-interval '1 second' where code=$1", [second.code]);
    assert.equal((await valid(second.code)).error, 'Este convite expirou');
    await assert.rejects(signup(second.code, 'expired@example.com', 103), /expirou/);
    await actor(owner);
    const legacy = (await db.query("select issue_user_invitation('bound@example.com') as invite")).rows[0].invite;
    await assert.rejects(signup(legacy.code, 'wrong@example.com', 104), /outro email/);
    await signup(legacy.code, 'bound@example.com', 105);
    await actor(owner);
    const emptyEmail = await issue(12);
    await assert.rejects(signup(emptyEmail.code, '', 106), /Email obrigatório/);
    // Delegated issuer loses access before recipient redemption.
    await db.exec(`insert into invitation_permissions(user_id,granted_by) values('${outsider}','${owner}')`);
    await actor(outsider);
    const revoked = await issue(13);
    await db.exec('reset role; delete from invitation_permissions');
    assert.equal((await valid(revoked.code)).valid, false);
    await assert.rejects(signup(revoked.code, 'revoked@example.com', 107), /não está autorizado/);
    // Concurrent callers are serialized; only one account can redeem a token.
    await actor(owner);
    const race = await issue(14);
    await db.exec('reset role');
    const attempts = await Promise.allSettled([signup(race.code, 'race1@example.com', 108), signup(race.code, 'race2@example.com', 109)]);
    assert.equal(attempts.filter(r => r.status === 'fulfilled').length, 1);
    await actor(owner);
    for (let n = 200; n < 296; n++) await issue(n);
    await assert.rejects(issue(296), /Limite diário/);
    assert.ok(await issue(200), 'idempotent retry still works at daily limit');
  } finally { await db.close(); }
});
