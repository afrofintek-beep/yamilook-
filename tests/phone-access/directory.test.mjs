import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('directory enforces consent, identity, blocks, rate limits and private data access', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role; create role supabase_auth_admin;
   create schema auth;
   create table auth.users(id uuid primary key, phone text, phone_confirmed_at timestamptz, is_anonymous boolean default false, deleted_at timestamptz);
   create table public.public_profiles(id uuid primary key,display_name text,username text,avatar_url text,bio text);
   create table public.blocked_users(blocker_id uuid,blocked_id uuid);
   insert into auth.users(id,phone,phone_confirmed_at) values
    ('00000000-0000-0000-0000-000000000001','244900000001',now()),
    ('00000000-0000-0000-0000-000000000002','244900000002',now()),
    ('00000000-0000-0000-0000-000000000003',null,null);
   insert into public.public_profiles(id,display_name) select id,'Test' from auth.users;`);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261109014124_phone_access_directory.sql',import.meta.url),'utf8'));
  const hook = await db.query("select public.reject_phone_only_signup('{\"user\":{\"phone\":\"244900000001\"}}'::jsonb) as result");
  assert.equal(hook.rows[0].result.error.http_code,403);
  const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002', c='00000000-0000-0000-0000-000000000003';
  const action=async(actor,kind,phone=null,enabled=null)=>(await db.query('select public.phone_directory_action($1,$2,$3,$4) as result',[actor,kind,phone,enabled])).rows[0].result;
  assert.deepEqual((await action(a,'search','+244900000002')).profiles,[]);
  await assert.rejects(action(c,'consent',null,true),/verified_phone_required/);
  await action(b,'consent',null,true);
  const found=(await action(a,'search','+244900000002')).profiles;
  assert.equal(found[0].id,b); assert.equal('phone' in found[0],false);
  assert.deepEqual((await action(b,'search','+244900000002')).profiles,[]);
  await db.query('insert into public.blocked_users values($1,$2)',[b,a]);
  assert.deepEqual((await action(a,'search','+244900000002')).profiles,[]);
  await db.exec('delete from public.blocked_users');
  await action(b,'consent',null,false);
  assert.deepEqual((await action(a,'search','+244900000002')).profiles,[]);
  await action(b,'consent',null,true);
  await db.query('update auth.users set phone=$1 where id=$2',['244900000004',b]);
  assert.deepEqual((await action(a,'search','+244900000004')).profiles,[]);
  assert.equal((await action(b,'status')).enabled,false);
  await action(b,'consent',null,true);
  await db.query('update auth.users set phone_confirmed_at=null where id=$1',[b]);
  assert.deepEqual((await action(a,'search','+244900000004')).profiles,[]);
  await assert.rejects(action(a,'search','900'),/invalid_phone/);
  for(let n=0;n<30;n++) await action(a,'search','+244900000002');
  assert.equal((await action(a,'search','+244900000002')).reason,'rate_limited');
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from public.phone_directory_preferences'),/permission denied/);
  await assert.rejects(action(a,'search','+244900000002'),/permission denied/);
  await db.exec('reset role; set role anon');
  await assert.rejects(action(a,'status'),/permission denied/);
 } finally { await db.close(); }
});
