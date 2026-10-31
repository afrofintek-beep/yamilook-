import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
test('persisted session clock, mentor authorization, and audit', async () => {
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated;
   create table academia_sessions(id uuid primary key,mentor_id uuid,status text);
   create table academia_session_actions(session_id uuid,actor_id uuid,action text,reason text);
   alter table academia_sessions enable row level security;
   grant select,insert,update on academia_sessions to authenticated;
   create policy mentor on academia_sessions for all to authenticated using(mentor_id=auth.uid()) with check(mentor_id=auth.uid());
   insert into academia_sessions values('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','scheduled');`);
  const file=(await readdir(new URL('../supabase/migrations/',import.meta.url))).find(f=>f.endsWith('_academia_session_clock.sql'));
  await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);`);
  await db.exec(`update academia_sessions set status='live', started_at='2000-01-01';`);
  const start=(await db.query('select started_at from academia_sessions')).rows[0].started_at;
  assert.ok(start);assert.notEqual(new Date(start).getFullYear(),2000);
  await db.exec(`update academia_sessions set started_at='2000-01-01',duration_minutes=75;`);
  assert.deepEqual((await db.query('select started_at from academia_sessions')).rows[0].started_at,start);
  await assert.rejects(db.exec('update academia_sessions set duration_minutes=60'),/extension_required/);
  await assert.rejects(db.exec('update academia_sessions set duration_minutes=500'),/check constraint/);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);`);
  assert.equal((await db.query('update academia_sessions set duration_minutes=90 returning id')).rows.length,0);
  await db.exec(`select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false); update academia_sessions set status='ended';`);
  assert.ok((await db.query('select ended_at from academia_sessions')).rows[0].ended_at);
  await assert.rejects(db.exec('update academia_sessions set duration_minutes=90'),/mentor_required/);
  await assert.rejects(db.exec('select * from academia_session_actions'),/permission denied/);
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int as n from academia_session_actions')).rows[0].n,3);
 } finally {await db.close();}
});
