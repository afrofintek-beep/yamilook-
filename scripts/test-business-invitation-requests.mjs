import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key default gen_random_uuid(),email text, email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function public.has_role(uuid,text) returns boolean language sql as $$ select false $$;
    create table public.mvp_candidates(id uuid primary key default gen_random_uuid(), full_name text,email text unique,
      status text default 'pending', access_code text,code_used boolean default false,code_used_by uuid references auth.users(id),
      code_used_at timestamptz,created_at timestamptz default now());`);
  await db.exec(await readFile(new URL('../supabase/migrations/20261123030000_business_invitation_requests.sql', import.meta.url), 'utf8'));
  await db.exec('set role anon');
  const submit = (year, planned) => db.query("select request_business_invitation('Ana',' ANA@example.com ','Quitanda','Fruta','luanda',$1,$2,'pt')",[year,planned]);
  await submit(2021,false);
  await submit(2022,false);
  await assert.rejects(submit(null,false));
  await assert.rejects(submit(9999,false));
  await assert.rejects(db.query('select * from business_invitation_drafts'));
  await assert.rejects(db.query('select * from my_business_invitation_drafts()'));
  await db.exec('reset role');
  assert.deepEqual((await db.query('select start_year from business_invitation_drafts')).rows,[{start_year:2021}]);
  await db.exec("update mvp_candidates set status='approved',access_code='ABCD-1234'");
  const signup = email => db.query(`insert into auth.users(email,raw_user_meta_data) values ($1,'{"access_code":"ABCD-1234"}') returning id`,[email]);
  await assert.rejects(signup('other@example.com'));
  const {rows:[user]}=await signup('ana@example.com');
  await assert.rejects(signup('ana@example.com'));
  await db.query("select set_config('test.uid',$1,false)",[user.id]);
  const recover = () => db.query('select name,start_year from my_business_invitation_drafts()');
  assert.equal((await recover()).rows.length,0);
  await db.exec('update auth.users set email_confirmed_at=now(); set role authenticated');
  assert.deepEqual((await recover()).rows,[{name:'Quitanda',start_year:2021}]);
  await db.query("select set_config('test.uid',gen_random_uuid()::text,false)");
  assert.equal((await recover()).rows.length,0);
  console.log('Business invitation submission, deduplication, redemption and verified recovery passed.');
} finally { await db.close(); }
