const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  let checks = 0;
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
  const denied = async (operation, message) => { await assert.rejects(operation, message); checks++; };
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key, is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key, user_id uuid);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('session_id', current_setting('test.sid', true)) $$;
    create table public.profiles(id uuid primary key, username text, display_name text, account_status text default 'active');
    create type public.app_role as enum ('admin', 'moderator', 'user');
    create table public.user_roles(user_id uuid, role public.app_role);
    create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
      language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
  `);
  const sessionMigration = fs.readFileSync('supabase/migrations/20261027001500_secure_multi_device_sessions.sql', 'utf8');
  await db.exec(sessionMigration.match(/create or replace function public\.account_current_session_id\(\)[\s\S]*?\$\$;/)[0]);
  const migration = fs.readdirSync('supabase/migrations').find(name => name.endsWith('_restricted_integration_access.sql'));
  await db.exec(fs.readFileSync('supabase/migrations/' + migration, 'utf8'));

  const users = [1, 2, 3].map(n => `00000000-0000-4000-8000-00000000000${n}`);
  const sessions = [1, 2, 3].map(n => `10000000-0000-4000-8000-00000000000${n}`);
  for (let n = 0; n < users.length; n++) {
    await db.query('insert into auth.users(id) values($1)', [users[n]]);
    await db.query('insert into auth.sessions values($1,$2)', [sessions[n], users[n]]);
    await db.query('insert into profiles(id,username,display_name) values($1,$2,$3)', [users[n], 'user' + n, 'Profile ' + n]);
  }
  await db.query("insert into user_roles values($1,'admin'),($2,'moderator')", [users[0], users[2]]);
  const login = async n => db.query("select set_config('test.uid',$1,false),set_config('test.sid',$2,false)", [n === null ? '' : users[n], n === null ? '' : sessions[n]]);
  const asRole = async (role, fn) => { await db.exec('set role ' + role); try { return await fn(); } finally { await db.exec('reset role'); } };
  const call = async (action = 'status', target = null, feature = null) => asRole('authenticated', async () => (
    await db.query('select public.integration_access_manage($1,$2,$3) as result', [action, target, feature])
  ).rows[0].result);

  await login(null);
  await denied(() => asRole('anon', () => db.query('select public.integration_access_manage()')), /permission denied/);
  await denied(() => call(), /Authentication required/);
  await login(1);
  equal(await call(), { userId: users[1], admin: false, googleMaps: false, maguela: false }, 'ordinary user starts hidden');
  for (const action of ['list', 'grant', 'revoke']) await denied(() => call(action, action === 'list' ? null : users[1], action === 'list' ? null : 'google_maps'), /Administrator required/);
  await denied(() => call('status', users[0]), /Invalid request/);
  for (const statement of [
    'select * from integration_access_private.grants',
    `insert into integration_access_private.grants(user_id,feature) values('${users[1]}','maguela')`,
    `update integration_access_private.grants set feature='maguela'`,
    'delete from integration_access_private.grants',
  ]) await denied(() => asRole('authenticated', () => db.exec(statement)), /permission denied/);
  await login(2);
  equal((await call()).maguela, false, 'moderator is not administrator');
  await denied(() => call('grant', users[2], 'maguela'), /Administrator required/);

  await login(0);
  equal(await call(), { userId: users[0], admin: true, googleMaps: true, maguela: true }, 'administrator needs no grant row');
  equal(await call('list'), [], 'no profiles are enrolled automatically');
  equal(await call('grant', users[1], 'google_maps'), { ok: true });
  await call('grant', users[1], 'google_maps');
  equal((await call('list')).length, 1, 'repeated grant is idempotent');
  await login(1);
  equal(await call(), { userId: users[1], admin: false, googleMaps: true, maguela: false }, 'Google only');
  await login(0);
  await call('grant', users[1], 'maguela');
  await login(1);
  equal((await call()).maguela, true, 'independent MAGUELA grant');
  await login(0);
  await call('revoke', users[1], 'google_maps');
  await login(1);
  equal(await call(), { userId: users[1], admin: false, googleMaps: false, maguela: true }, 'revoke preserves the other feature');

  await login(0);
  await denied(() => call('grant', users[1], 'wallet'), /Invalid request/);
  await denied(() => call('grant', null, 'google_maps'), /Invalid request/);
  await denied(() => call(null), /Invalid request/);
  await denied(() => call('grant', '00000000-0000-4000-8000-000000000099', 'maguela'), /Active profile required/);
  await db.query("update profiles set account_status='suspended' where id=$1", [users[1]]);
  await denied(() => call('grant', users[1], 'google_maps'), /Active profile required/);
  await login(1);
  await denied(() => call(), /Active account required/);
  await db.query("update profiles set account_status='active' where id=$1", [users[1]]);
  await db.query('delete from auth.sessions where id=$1', [sessions[1]]);
  await denied(() => call(), /Session expired or revoked/);
  await login(0);
  await call('revoke', users[1], 'maguela');
  equal(await call('list'), [], 'all explicit grants removed');
  await db.query('delete from user_roles where user_id=$1', [users[0]]);
  equal(await call(), { userId: users[0], admin: false, googleMaps: false, maguela: false }, 'administrator demotion is live');
  await denied(() => call('grant', users[1], 'maguela'), /Administrator required/);
  await db.query('update auth.users set is_anonymous=true where id=$1', [users[2]]);
  await login(2);
  await denied(() => call(), /Active account required/);
  equal((await db.query("select relrowsecurity from pg_class where oid='integration_access_private.grants'::regclass")).rows[0].relrowsecurity, true);
  equal((await db.query("select prosecdef from pg_proc where oid='public.integration_access_manage(text,uuid,text)'::regprocedure")).rows[0].prosecdef, false);
  console.log(`Integration access: ${checks} database checks passed.`);
  await db.close();
})().catch(error => { console.error(error); process.exit(1); });
