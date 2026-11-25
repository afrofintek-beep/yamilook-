const { PGlite } = require('@electric-sql/pglite');
const fs = require('node:fs');
module.exports = async function accessFixture() {
  const db = new PGlite();
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
  return { db, users, sessions, migration };
};
