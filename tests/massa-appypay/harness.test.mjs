import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { applyHarness, buildHarnessSql, harnessManifest, readHarnessParts } from './fixtures/harness.mjs';

// PGlite supplies one Postgres session. Only the hosted Supabase auth foundation
// is emulated here. Profiles, roles, has_role, pilot access, wallet authorisation
// and the ledger all come from actual repository DDL/migrations.
const db = new PGlite();
const id = n => `4d415353-4150-4000-8000-${String(n).padStart(12, '0')}`;
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
      nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb
  $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);
const parts = readHarnessParts();

async function baselineAttempt(project) {
  await db.exec('begin');
  try {
    if (project) await db.query("select set_config('massa.harness_project',$1,true)", [project]);
    await db.exec(parts[0].sql);
  } finally { await db.exec('rollback'); }
}
async function asRole(role, callback, user = null) {
  assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
  await db.exec(`set role ${role}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)", [
    user ? id(user) : '', JSON.stringify({ sub: user ? id(user) : undefined, role, session_id: id(999), aal: 'aal2' }),
  ]);
  try { return await callback(); } finally { await db.exec('reset role'); }
}
const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const act = (user, action, reference = null, amount = null, description = null) => asRole('authenticated',
  async () => (await one('select public.payment_point_action($1,$2,$3,$4) value', [action, reference, amount, description])).value, user);
const manage = (user, action, target) => asRole('authenticated',
  async () => (await one('select public.wallet_pilot_manage($1,$2) value', [action, target ? id(target) : null])).value, user);
const rpc = (name, values) => asRole('service_role', async () =>
  (await one(`select public.${name}(${values.map((_, index) => `$${index + 1}`).join(',')}) value`, values)).value);

await test('harness uses exact dependency extracts and ten complete original wallet migrations', () => {
  assert.equal(harnessManifest.wallet_migrations.length, 10);
  assert.equal(parts.length, 11);
  assert.ok(parts[0].sql.includes('FROM public.user_roles'));
  assert.ok(!parts[0].sql.includes("WHERE email = 'maria@yamilook.test'"));
  assert.ok(!parts[0].sql.includes('create or replace function public.fulfill_kumbu_purchase'));
  assert.ok(!parts[0].sql.includes('create function public.has_wallet_access'));
  const combined = buildHarnessSql();
  for (const part of parts) assert.ok(combined.includes(part.sql));
  assert.match(combined, /^begin;/);
  assert.match(combined, /commit;\n$/);
});

await test('bootstrap refuses missing opt-in, a nonempty app schema or pre-existing auth users before creating anything', async () => {
  await assert.rejects(baselineAttempt(), /dedicated project opt-in/);
  await assert.rejects(baselineAttempt('another-project'), /dedicated project opt-in/);
  await db.exec('create table public.already_here(id integer)');
  await assert.rejects(baselineAttempt(harnessManifest.target_project), /empty application schema/);
  await db.exec('drop table public.already_here');
  await db.query('insert into auth.users(id) values($1)', [id(99)]);
  await assert.rejects(baselineAttempt(harnessManifest.target_project), /auth.users to be empty/);
  await db.query('delete from auth.users where id=$1', [id(99)]);
  assert.equal((await one("select to_regclass('public.profiles') value")).value, null);
  assert.equal((await one("select to_regnamespace('massa_test_harness') value")).value, null);
});

await test('the real chain installs atomically on the branch preconditions without seeding users or administrators', async () => {
  await applyHarness(db);
  assert.equal((await one('select count(*)::int n from auth.users')).n, 0);
  assert.equal((await one('select count(*)::int n from public.user_roles')).n, 0);
  assert.equal((await one('select count(*)::int n from public.wallet_pilot_access')).n, 0);
  assert.equal((await one('select target_project from massa_test_harness.installation')).target_project, harnessManifest.target_project);
  assert.match((await one("select pg_get_functiondef('payment_point_private.payment_point_action(text,uuid,bigint,text)'::regprocedure) body")).body, /group by journal_id,operation,reference/);
  assert.equal((await one("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='massa_gateway' and c.relkind='r' and c.relrowsecurity")).n, 3);
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await asRole(role, () => assert.rejects(db.query('select * from massa_gateway.attempts'), /permission denied/));
    await asRole(role, () => assert.rejects(db.query('select * from massa_test_harness.installation'), /permission denied/));
  }
  await assert.rejects(applyHarness(db), /empty application schema/);
  assert.equal((await one('select count(*)::int n from massa_test_harness.installation')).n, 1);
});

await test('the PostgreSQL rollback verification script leaves no synthetic accounts, grants, balances or gateway evidence', async () => {
  try {
    await db.exec(readFileSync(new URL('./fixtures/postgres-rollback.sql', import.meta.url), 'utf8'));
  } catch (error) {
    await db.exec('rollback');
    throw error;
  }
  for (const table of ['auth.users', 'public.user_roles', 'public.wallet_pilot_access',
    'public.payment_point_wallets', 'public.payment_point_entries', 'massa_gateway.attempts', 'massa_gateway.observations']) {
    assert.equal((await one(`select count(*)::int n from ${table}`)).n, 0, table);
  }
});

await test('real table-backed roles and administrator pilot grants gate both wallet and service RPC entry points', async () => {
  for (const n of [1, 2, 3, 9]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id(n), `massa-harness-${n}@example.invalid`]);
    await db.query('insert into public.profiles(id,display_name,username,country_code) values($1,$2,$3,$4)',
      [id(n), `Synthetic MASSA ${n}`, `massa_harness_${n}`, 'AO']);
  }
  assert.equal((await one("select public.has_role($1,'admin') value", [id(9)])).value, false);
  await db.query("insert into public.user_roles(user_id,role) values($1,'admin')", [id(9)]);
  assert.equal((await one("select public.has_role($1,'admin') value", [id(9)])).value, true);
  assert.equal((await manage(1, 'status')).allowed, false);
  assert.equal((await manage(9, 'status')).allowed, true);
  await assert.rejects(manage(1, 'grant', 1), /administradores/);
  await assert.rejects(act(1, 'overview'), /reservado/);
  await assert.rejects(rpc('massa_gateway_prepare', [id(1), id(201), 'REF', null, 'MASSA_HARNESS', null, 100]), /reservado/);
  await manage(9, 'grant', 1);
  await manage(9, 'grant', 2);
  assert.equal((await manage(1, 'status')).allowed, true);
  assert.equal((await manage(1, 'status')).admin, false);
  assert.equal((await act(1, 'overview')).wallet.purchased, 0);
  await manage(9, 'revoke', 1);
  await assert.rejects(act(1, 'overview'), /reservado/);
  await assert.rejects(rpc('massa_gateway_prepare', [id(1), id(201), 'REF', null, 'MASSA_HARNESS', null, 100]), /reservado/);
  await manage(9, 'grant', 1);
});

await test('profile owner RLS and role ACLs remain effective with Supabase-style default public grants', async () => {
  await asRole('anon', () => assert.rejects(db.query('select id from public.profiles'), /permission denied/));
  await asRole('authenticated', async () => {
    assert.deepEqual((await db.query('select id from public.profiles')).rows, [{ id: id(1) }]);
    assert.deepEqual((await db.query('select user_id from public.user_roles')).rows, []);
    await assert.rejects(db.query("insert into public.user_roles(user_id,role) values($1,'admin')", [id(1)]), /permission denied/);
    await assert.rejects(db.query("update public.profiles set country_code='PT' where id=$1", [id(1)]), /permission denied/);
    await assert.rejects(db.query('select public.massa_gateway_prepare($1,$2,$3,$4,$5,$6,$7)', [id(1), id(201), 'REF', null, 'MASSA_HARNESS', null, 100]), /permission denied/);
  }, 1);
});

await test('real Angola profile columns gate internal and external actor and recipient paths', async () => {
  await act(2, 'merchant');
  await act(2, 'create', id(251), 500, 'Synthetic geography check');
  await db.query("update public.profiles set country_code='PT' where id=$1", [id(1)]);
  await assert.rejects(act(1, 'topup', id(252), 100), /Angola/);
  await assert.rejects(rpc('massa_gateway_prepare', [id(1), id(253), 'REF', null, 'MASSA_HARNESS', null, 100]), /Angola/);
  await db.query("update public.profiles set country_code='AO' where id=$1", [id(1)]);
  await db.query("update public.profiles set country_code='PT' where id=$1", [id(2)]);
  await assert.rejects(rpc('massa_gateway_prepare', [id(1), id(254), 'REF', null, 'MASSA_HARNESS', id(251), null]), /Destinatário indisponível/);
  await db.query("update public.profiles set country_code='AO' where id=$1", [id(2)]);
  assert.equal((await one('select count(*)::int n from massa_gateway.attempts')).n, 0);
});

await test('full wrappers retain debit authorisation and apply an external confirmation exactly once to a balanced immutable ledger', async () => {
  await act(2, 'merchant');
  await act(1, 'topup', id(301), 10000);
  await act(2, 'create', id(302), 2500, 'Synthetic internal authorisation check');
  await assert.rejects(act(1, 'pay', id(302)), /chave da carteira/);
  await act(2, 'create', id(303), 12345, 'Synthetic external confirmation');
  const created = await rpc('massa_gateway_prepare', [id(1), id(304), 'REF', null, 'MASSA_HARNESS', id(303), null]);
  await assert.rejects(act(2, 'cancel', id(303)), /externa/);
  const pending = await rpc('massa_gateway_record', [created.id, id(801), 'pending', 101]);
  const params = [pending.id, id(801), pending.merchant_ref, 12345, 'AOA', 'REF'];
  const confirmed = await rpc('massa_gateway_confirm', params);
  assert.equal(confirmed.state, 'confirmed');
  assert.equal((await rpc('massa_gateway_confirm', params)).state, 'confirmed');
  assert.equal((await act(2, 'overview')).wallet.earned, 12345);
  assert.equal((await act(1, 'overview')).wallet.purchased, 10000);
  assert.equal((await act(2, 'view', id(303))).payment_provider, 'appypay');
  assert.equal((await one('select count(*)::int n from payment_point_private.journals where reference=$1', [id(303)])).n, 1);
  assert.equal(Number((await one('select sum(amount) value from public.payment_point_entries where reference=$1', [id(303)])).value), 0);
  await assert.rejects(act(2, 'refund', id(303)), /prestador/);
  await assert.rejects(db.query('delete from public.payment_point_entries where reference=$1', [id(303)]), /Immutable ledger/);
  await asRole('authenticated', async () => {
    assert.equal((await one('select count(*)::int n from public.payment_point_wallets')).n, 0);
    assert.equal((await one('select count(*)::int n from public.payment_point_orders')).n, 0);
    assert.equal((await one('select count(*)::int n from public.payment_point_entries')).n, 0);
  }, 3);
});

await db.close();
