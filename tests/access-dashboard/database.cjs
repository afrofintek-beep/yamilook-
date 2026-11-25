const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
const assert = require('node:assert/strict');

(async () => {
  const db = new PGlite();
  let checks = 0;
  const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
  const ok = (value, message) => { assert.ok(value, message); checks++; };
  const denied = async (operation, expected) => { await assert.rejects(operation, expected); checks++; };
  const migration = suffix => fs.readFileSync('supabase/migrations/' + fs.readdirSync('supabase/migrations').find(name => name.endsWith(suffix)), 'utf8');
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema payment_point_private;
    create table auth.users(id uuid primary key, email text, is_anonymous boolean default false, created_at timestamptz default now());
    create table auth.sessions(id uuid primary key, user_id uuid references auth.users(id));
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('session_id', current_setting('test.sid', true)) $$;
    create table public.profiles(
      id uuid primary key references auth.users(id), username text unique, display_name text,
      account_status text default 'active', created_at timestamptz default now(), avatar_url text, email text
    );
    create type public.app_role as enum ('admin', 'moderator', 'user');
    create table public.user_roles(user_id uuid references auth.users(id), role public.app_role);
    create function public.has_role(_user_id uuid, _role public.app_role) returns boolean
      language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
    create table public.kumbu_purchases(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id));
    grant insert on public.kumbu_purchases to service_role;
    create table public.business_profiles(id uuid primary key default gen_random_uuid(), owner_id uuid, name text);
    alter table public.business_profiles enable row level security;
    grant insert, select on public.business_profiles to authenticated;
    create policy owner_insert on public.business_profiles for insert to authenticated with check(owner_id=auth.uid());
    create table public.mvp_candidates(
      id uuid primary key default gen_random_uuid(), code_used_by uuid references auth.users(id),
      code_used boolean default false, status text default 'pending', email text unique,
      full_name text, created_at timestamptz default now()
    );
    create table public.business_invitation_drafts(
      candidate_id uuid primary key references public.mvp_candidates(id), name text, activity text,
      scene text, start_year integer, planned boolean, language text
    );
  `);
  const sessionMigration = migration('_secure_multi_device_sessions.sql');
  await db.exec(sessionMigration.match(/create or replace function public\.account_current_session_id\(\)[\s\S]*?\$\$;/)[0]);
  await db.exec(migration('_restricted_integration_access.sql'));
  await db.exec(migration('_wallet_private_pilot.sql'));
  await db.exec(migration('_private_business_registration.sql'));

  const users = Array.from({ length: 10 }, (_, n) => `00000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`);
  const sessions = users.map((_, n) => `10000000-0000-4000-8000-${String(n + 1).padStart(12, '0')}`);
  for (let n = 0; n < users.length; n++) {
    await db.query("insert into auth.users(id,email,created_at) values($1,$2,now()-($3 || ' days')::interval)", [users[n], `user${n}@example.test`, n === 4 ? 1 : 60]);
    await db.query('insert into auth.sessions values($1,$2)', [sessions[n], users[n]]);
    // Public profile timestamps cannot make a young authentication account old.
    await db.query("insert into profiles(id,username,display_name,created_at) values($1,$2,$3,now()-interval '60 days')", [users[n], 'user' + n, n === 3 ? 'António Teste' : 'Profile ' + n]);
  }
  await db.query("insert into user_roles values($1,'admin'),($2,'moderator'),($3,'admin')", [users[0], users[2], users[8]]);
  await db.query("update profiles set account_status='suspended' where id=$1", [users[5]]);
  await db.query('update auth.users set is_anonymous=true where id=$1', [users[7]]);

  // Seed real legacy sources before applying the dashboard migration.
  await db.query("insert into integration_access_private.grants(user_id,feature,granted_by) values($1,'google_maps',$2)", [users[1], users[0]]);
  await db.query('insert into wallet_pilot_access(user_id,granted_by) values($1,$2)', [users[1], users[0]]);
  await db.query('insert into business_registration_access(user_id) values($1)', [users[3]]);
  const candidate = (await db.query("insert into mvp_candidates(code_used_by,code_used,status,email) values($1,true,'approved',$2) returning id", [users[6], 'business@example.test'])).rows[0].id;
  await db.query('insert into business_invitation_drafts(candidate_id,name) values($1,$2)', [candidate, 'Legacy business']);
  await db.exec(migration('_admin_visibility_dashboard.sql'));

  const login = async n => db.query("select set_config('test.uid',$1,false),set_config('test.sid',$2,false)", [n === null ? '' : users[n], n === null ? '' : sessions[n]]);
  const asRole = async (role, operation) => { await db.exec('set role ' + role); try { return await operation(); } finally { await db.exec('reset role'); } };
  const call = async (action = 'status', data = {}) => asRole('authenticated', async () => (
    await db.query('select public.access_dashboard_manage($1,$2) as result', [action, JSON.stringify(data)])
  ).rows[0].result);
  const legacyIntegration = async (action = 'status', target = null, feature = null) => asRole('authenticated', async () => (
    await db.query('select public.integration_access_manage($1,$2,$3) as result', [action, target, feature])
  ).rows[0].result);
  const legacyWallet = async (action = 'status', identifier = null) => asRole('authenticated', async () => (
    await db.query('select public.wallet_pilot_manage($1,$2) as result', [action, identifier])
  ).rows[0].result);
  const businessAccess = async () => asRole('authenticated', async () => (await db.query('select public.has_business_registration_access() as allowed')).rows[0].allowed);

  const features = ['google_maps', 'maguela', 'wallet', 'business_registration'];
  const policy = async feature => (await call('dashboard')).policies.find(item => item.feature === feature);
  const save = async (feature, patch = {}) => {
    const current = await policy(feature);
    const next = { ...current, ...patch, criteria: patch.criteria ? { ...current.criteria, ...patch.criteria } : current.criteria };
    const { mode, enabled, startsAt, endsAt, criteria, revision } = next;
    return call('save_policy', { feature, mode, enabled, startsAt, endsAt, criteria, revision });
  };
  const override = async (feature, n, effect, extra = {}) => call('set_override', { feature, userId: users[n], effect, expiresAt: null, note: 'Database verification', ...extra });
  const preview = async n => call('preview', { userId: users[n] });
  const decision = async (n, feature) => (await preview(n)).find(item => item.feature === feature);
  const since = offset => new Date(Date.now() + offset).toISOString();
  const day = 24 * 60 * 60 * 1000;

  await login(null);
  await denied(() => asRole('anon', () => db.query('select public.access_dashboard_manage($1,$2)', ['status', '{}'])), /permission denied/);
  await denied(() => call(), /Authentication required/);
  await login(1);
  equal((await call()).userId, users[1], 'status belongs to the authenticated caller');
  await denied(() => call('status', { userId: users[0] }), error => error.code === '22023');
  for (const action of ['dashboard', 'search_profiles', 'save_policy', 'set_override', 'create_group', 'set_group_member', 'preview']) {
    await denied(() => call(action, {}), /Administrator required/);
  }
  for (const table of ['policies', 'overrides', 'groups', 'group_members', 'audit']) {
    await denied(() => asRole('authenticated', () => db.query(`select * from integration_access_private.${table}`)), /permission denied/);
    await denied(() => asRole('authenticated', () => db.exec(`delete from integration_access_private.${table}`)), /permission denied/);
  }
  await denied(() => asRole('authenticated', () => db.query('select integration_access_private.decision($1,$2)', [users[0], 'wallet'])), /permission denied/);
  await denied(() => asRole('authenticated', () => db.query("insert into integration_access_private.overrides(feature,user_id,effect) values('wallet',$1,'allow')", [users[1]])), /permission denied/);
  await denied(() => asRole('authenticated', () => db.query('insert into business_registration_access(user_id) values($1)', [users[1]])), /row-level security/);
  await login(2);
  await denied(() => call('set_override', { feature: 'wallet', userId: users[2], effect: 'allow', expiresAt: null, note: '' }), /Administrator required/);
  await login(0);
  const initial = await call('dashboard');
  equal(initial.policies.map(item => item.feature).sort(), [...features].sort(), 'exactly the supported four features are managed');
  ok(initial.policies.every(item => item.mode === 'selected' && item.enabled === true), 'migration preserves the existing selected rollout');
  equal((await decision(1, 'google_maps')).allowed, true, 'existing integration grant imported');
  equal((await decision(1, 'wallet')).allowed, true, 'existing wallet grant imported');
  equal((await decision(3, 'business_registration')).allowed, true, 'existing business grant imported');
  equal((await decision(6, 'business_registration')).allowed, true, 'approved consumed business invitation preserved');
  equal((await decision(1, 'maguela')).allowed, false, 'wallet enrollment does not enroll MAGUELA');
  equal((await decision(4, 'wallet')).allowed, false, 'ordinary profiles are not enrolled');
  equal((await preview(0)).every(item => item.allowed), true, 'administrator can inspect all features');
  equal((await preview(5)).every(item => !item.allowed), true, 'suspended profile is always denied');
  equal((await preview(7)).every(item => !item.allowed), true, 'anonymous profile is always denied');

  const auditBeforeRead = (await call('dashboard')).audit.length;
  await preview(3);
  equal((await call('dashboard')).audit.length, auditBeforeRead, 'preview is read-only');
  const matches = await call('search_profiles', { query: 'user3' });
  equal(matches.map(item => item.id), [users[3]], 'profile search resolves a real account');
  equal((await call('search_profiles', { query: 'definitely-absent' })).length, 0, 'unknown profile does not invent a result');

  // Global policy always precedes a per-profile exception.
  await override('google_maps', 4, 'allow');
  equal((await decision(4, 'google_maps')).allowed, true, 'named allow works in selected mode');
  await save('google_maps', { enabled: false });
  equal((await decision(4, 'google_maps')).allowed, false, 'pause wins over explicit allow');
  equal((await decision(0, 'google_maps')).allowed, true, 'administrator remains available during pause');
  await save('google_maps', { enabled: true, startsAt: since(day), endsAt: since(2 * day) });
  equal((await decision(4, 'google_maps')).allowed, false, 'future start wins over explicit allow');
  await save('google_maps', { startsAt: since(-2 * day), endsAt: since(-day) });
  equal((await decision(4, 'google_maps')).allowed, false, 'expired rollout is closed');
  await save('google_maps', { startsAt: null, endsAt: null, mode: 'admins' });
  equal((await decision(4, 'google_maps')).allowed, false, 'admins mode ignores named allow');
  await denied(() => override('google_maps', 0, 'deny'), /Administrators have automatic access/);
  equal((await decision(0, 'google_maps')).allowed, true, 'administrator cannot lock itself out');
  await save('google_maps', { mode: 'all' });
  equal((await decision(3, 'google_maps')).allowed, true, 'all mode admits active ordinary profiles');
  await override('google_maps', 3, 'deny');
  equal((await decision(3, 'google_maps')).allowed, false, 'explicit deny wins over all');
  await override('google_maps', 3, 'inherit');
  equal((await decision(3, 'google_maps')).allowed, true, 'inherit removes the exception and uses policy');
  await save('google_maps', { mode: 'selected' });
  await override('google_maps', 4, 'inherit');
  equal((await decision(4, 'google_maps')).allowed, false, 'inherit does not enroll selected profiles');

  await override('google_maps', 4, 'allow', { expiresAt: since(day) });
  equal((await decision(4, 'google_maps')).allowed, true, 'unexpired named allow is active');
  await db.query("update integration_access_private.overrides set expires_at=now()-interval '1 second' where feature='google_maps' and user_id=$1", [users[4]]);
  equal((await decision(4, 'google_maps')).allowed, false, 'expired allow falls back to selected policy');
  await save('google_maps', { mode: 'all' });
  await override('google_maps', 4, 'deny', { expiresAt: since(day) });
  equal((await decision(4, 'google_maps')).allowed, false, 'unexpired named deny is active');
  await db.query("update integration_access_private.overrides set expires_at=now()-interval '1 second' where feature='google_maps' and user_id=$1", [users[4]]);
  equal((await decision(4, 'google_maps')).allowed, true, 'expired deny falls back to all policy');
  await denied(() => override('google_maps', 4, 'allow', { expiresAt: since(-day) }), error => error.code === '22023');

  // Revision conflicts must not partially change policy or write audit rows.
  const stale = await policy('maguela');
  await save('maguela', { mode: 'all' });
  const beforeConflict = await call('dashboard');
  const { feature: staleFeature, mode, enabled, startsAt, endsAt, criteria, revision } = stale;
  await denied(() => call('save_policy', { feature: staleFeature, mode, enabled, startsAt, endsAt, criteria, revision }), error => error.code === '40001');
  const afterConflict = await call('dashboard');
  equal(afterConflict.policies, beforeConflict.policies, 'stale write leaves policy intact');
  equal(afterConflict.audit, beforeConflict.audit, 'stale write leaves audit intact');
  const policyAudit = (await db.query("select * from integration_access_private.audit where feature='maguela' and action='policy_saved' order by id desc limit 1")).rows[0];
  equal(policyAudit.actor_id, users[0], 'policy audit identifies the acting administrator');
  equal(policyAudit.before_value.mode, 'selected', 'policy audit preserves the previous value');
  equal(policyAudit.after_value.mode, 'all', 'policy audit preserves the applied value');
  equal(policyAudit.after_value.revision, policyAudit.before_value.revision + 1, 'one successful save increments revision once');
  const visiblePolicyAudit = afterConflict.audit.find(item => item.id === String(policyAudit.id));
  equal(visiblePolicyAudit.before, policyAudit.before_value, 'dashboard exposes the saved previous policy');
  equal(visiblePolicyAudit.after, policyAudit.after_value, 'dashboard exposes the saved new policy');
  equal(visiblePolicyAudit.actorName, 'Profile 0', 'dashboard resolves the acting administrator');

  // Criteria are ANDed; membership in any one selected group is enough.
  await call('create_group', { name: 'Piloto Norte' });
  await call('create_group', { name: 'Piloto Sul' });
  const groups = (await call('dashboard')).groups;
  const north = groups.find(item => item.name === 'Piloto Norte').id;
  const south = groups.find(item => item.name === 'Piloto Sul').id;
  await denied(() => call('create_group', { name: 'piloto norte' }), error => error.code === '23505');
  for (const [groupId, n] of [[north, 2], [south, 3], [north, 4]]) {
    await call('set_group_member', { groupId, userId: users[n], included: true });
  }
  await save('maguela', { mode: 'criteria', criteria: { role: 'user', groupIds: [north, south], minAccountAgeDays: 30 } });
  equal((await decision(3, 'maguela')).allowed, true, 'ordinary user with no explicit role row matches user and second group');
  equal((await decision(2, 'maguela')).allowed, false, 'moderator does not match ordinary-user criterion');
  equal((await decision(4, 'maguela')).allowed, false, 'young account fails age even with correct group');
  equal((await decision(1, 'maguela')).allowed, false, 'old account fails absent group membership');
  await call('set_group_member', { groupId: south, userId: users[3], included: false });
  equal((await decision(3, 'maguela')).allowed, false, 'removing group membership changes effective access');
  const membershipAudit = (await call('dashboard')).audit.find(item => item.action === 'group_member_removed');
  equal(membershipAudit.before, { groupId: south, groupName: 'Piloto Sul', included: true }, 'membership audit shows previous membership');
  equal(membershipAudit.after, { groupId: south, groupName: 'Piloto Sul', included: false }, 'membership audit shows removed membership');
  equal(membershipAudit.targetName, 'António Teste', 'membership audit identifies the selected profile');
  await save('maguela', { criteria: { role: 'moderator', groupIds: [], minAccountAgeDays: 30 } });
  equal((await decision(2, 'maguela')).allowed, true, 'empty groups means no group filter');
  equal((await decision(3, 'maguela')).allowed, false, 'role restriction remains with no group filter');
  await override('maguela', 4, 'allow');
  equal((await decision(4, 'maguela')).allowed, true, 'named allow is an exception to criteria');
  await override('maguela', 2, 'deny');
  equal((await decision(2, 'maguela')).allowed, false, 'named deny overrides matching criteria');

  // Strict payload validation prevents accidentally widening a rollout.
  for (const criteria of [
    { role: 'any', groupIds: [], minAccountAgeDays: 0 },
    { role: 'unknown', groupIds: [], minAccountAgeDays: 1 },
    { role: 'any', groupIds: [], minAccountAgeDays: -1 },
    { role: 'any', groupIds: [], minAccountAgeDays: 0.5 },
    { role: 'any', groupIds: [], minAccountAgeDays: '30' },
    { role: 'any', groupIds: ['00000000-0000-4000-8000-000000009999'], minAccountAgeDays: 1 },
    { role: 'user', groupIds: [], minAccountAgeDays: 0, extra: true },
  ]) await denied(() => save('maguela', { mode: 'criteria', criteria }), error => error.code.startsWith('22'));
  await denied(() => save('maguela', { mode: 'unknown' }), error => error.code.startsWith('22'));
  await denied(() => save('maguela', { startsAt: since(day), endsAt: since(-day) }), error => error.code.startsWith('22'));
  await denied(() => call('set_override', { feature: 'unknown', userId: users[3], effect: 'allow', expiresAt: null, note: '' }), error => error.code.startsWith('22'));
  await denied(() => call('set_override', { feature: 'wallet', userId: '00000000-0000-4000-8000-000000009999', effect: 'allow', expiresAt: null, note: '' }), error => error.code.startsWith('22'));
  await denied(() => call('create_group', { name: '   ' }), error => error.code.startsWith('22'));
  await denied(() => call('set_group_member', { groupId: north, userId: users[3], included: 'true' }), error => error.code.startsWith('22'));

  // Existing UIs and service-side wallet triggers consume the same decisions.
  await save('google_maps', { mode: 'selected' });
  await legacyIntegration('grant', users[3], 'google_maps');
  equal((await decision(3, 'google_maps')).allowed, true, 'old integration grant enters the central engine');
  await save('wallet', { mode: 'all' });
  await legacyWallet('revoke', users[3]);
  equal((await decision(3, 'wallet')).allowed, false, 'old wallet revoke really denies in all mode');
  await legacyWallet('grant', users[3]);
  equal((await decision(3, 'wallet')).allowed, true, 'old wallet grant removes the old deny');
  await login(3);
  equal((await legacyWallet()).allowed, true, 'wallet status uses effective central policy');
  equal((await legacyIntegration()).googleMaps, true, 'integration status uses central policy');
  await login(null);
  await asRole('service_role', () => db.query('insert into kumbu_purchases(user_id) values($1)', [users[3]]));
  checks++;
  await login(0);
  await override('wallet', 3, 'deny');
  await login(null);
  await denied(() => asRole('service_role', () => db.query('insert into kumbu_purchases(user_id) values($1)', [users[3]])), /Acesso reservado/);

  await login(0);
  await override('business_registration', 6, 'deny');
  equal((await decision(6, 'business_registration')).allowed, false, 'explicit deny wins over legacy approved invitation');
  await override('business_registration', 6, 'inherit');
  equal((await decision(6, 'business_registration')).allowed, true, 'inherited selected policy preserves approved invitation');
  await save('business_registration', { mode: 'admins' });
  equal((await decision(6, 'business_registration')).allowed, false, 'legacy invitation cannot bypass admins mode');
  await save('business_registration', { mode: 'criteria', criteria: { role: 'moderator', groupIds: [], minAccountAgeDays: 0 } });
  equal((await decision(6, 'business_registration')).allowed, false, 'legacy invitation cannot bypass criteria mode');
  await save('business_registration', { mode: 'selected' });
  await asRole('authenticated', () => db.query('insert into business_registration_access(user_id) values($1)', [users[4]]));
  equal((await decision(4, 'business_registration')).allowed, true, 'legacy business insert synchronizes to central policy');
  await asRole('authenticated', () => db.query('delete from business_registration_access where user_id=$1', [users[4]]));
  equal((await decision(4, 'business_registration')).allowed, false, 'legacy business delete synchronizes to central policy');
  await login(6);
  equal(await businessAccess(), true, 'legacy business API uses the same evaluator');
  await asRole('authenticated', () => db.query('insert into business_profiles(owner_id,name) values($1,$2)', [users[6], 'Allowed business']));
  checks++;
  await login(0);
  await override('business_registration', 6, 'deny');
  await login(6);
  equal(await businessAccess(), false, 'business permission updates after deny');
  await denied(() => asRole('authenticated', () => db.query('insert into business_profiles(owner_id,name) values($1,$2)', [users[6], 'Denied business'])), /row-level security/);

  await login(5);
  await denied(() => call(), /Active account required/);
  await login(7);
  await denied(() => call(), /Active account required/);
  await login(8);
  await db.query('delete from auth.sessions where id=$1', [sessions[8]]);
  await denied(() => call('dashboard'), /Session expired or revoked/);
  await denied(() => asRole('authenticated', () => db.query('insert into business_registration_access(user_id) values($1)', [users[4]])), /Session expired or revoked/);
  equal((await db.query('select count(*)::int as count from business_registration_access where user_id=$1', [users[4]])).rows[0].count, 0, 'revoked admin direct write is rolled back');
  await db.query('insert into auth.sessions values($1,$2)', [sessions[8], users[8]]);
  await db.query("update profiles set account_status='suspended' where id=$1", [users[8]]);
  await denied(() => call('dashboard'), /Active account required/);
  await denied(() => asRole('authenticated', () => db.query('insert into business_registration_access(user_id) values($1)', [users[4]])), error => error.code === '42501');
  await login(0);
  const schemaChecks = (await db.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='integration_access_private' and c.relname in ('policies','overrides','groups','group_members','audit') order by c.relname")).rows;
  equal(schemaChecks.length, 5, 'all dashboard tables exist');
  ok(schemaChecks.every(row => row.relrowsecurity === true), 'all dashboard tables keep RLS');
  equal((await db.query("select prosecdef from pg_proc where oid='public.access_dashboard_manage(text,jsonb)'::regprocedure")).rows[0].prosecdef, false, 'public dashboard RPC is an invoker');
  await db.query('delete from user_roles where user_id=$1', [users[0]]);
  await denied(() => call('dashboard'), /Administrator required/);
  await denied(() => call('save_policy', {}), /Administrator required/);

  console.log(`Access dashboard: ${checks} database checks passed.`);
  await db.close();
})().catch(error => { console.error(error); process.exit(1); });
