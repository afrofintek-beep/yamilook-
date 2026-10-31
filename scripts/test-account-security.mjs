// Isolated PostgreSQL contracts. Never connects to a hosted database.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

function expand(file) {
  return fs.readFileSync(file, 'utf8').replace(/^\\ir (.+)$/gm,
    (_, relative) => expand(path.resolve(path.dirname(file), relative.trim())));
}
const sessions = new PGlite();
await sessions.exec(expand('supabase/tests/account_sessions_integration.sql'));
await sessions.close();
console.log('PASS existing multi-device SQL contract, including revocation isolation');

const db = new PGlite();
let checks = 0;
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
const check = (value, label) => { assert.ok(value, label); checks++; console.log('PASS', label); };
await db.exec(`
  create role anon; create role authenticated;
  create schema auth; create schema storage;
  grant usage on schema auth, storage to anon, authenticated;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
  $$;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select string_to_array(name,'/');
  $$;
  create function storage.extension(name text) returns text language sql immutable as $$
    select reverse(split_part(reverse(name),'.',1));
  $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to anon,authenticated;
`);
await db.exec(fs.readFileSync('supabase/migrations/20261031214253_account_backups.sql','utf8'));
check((await db.query("select not public and file_size_limit=20971520 and allowed_mime_types=array['application/json'] from storage.buckets")).rows[0]['?column?'], 'private JSON-only backup bucket, 20 MiB maximum');
check(!(await db.query("select has_function_privilege('anon','public.my_attributed_storage_usage()','execute') as allowed")).rows[0].allowed, 'anonymous usage RPC denied');
await db.query(`insert into storage.objects(bucket_id,name,owner_id,metadata) values
  ('media','image',$1,'{"size":100,"mimetype":"image/jpeg"}'),
  ('media','video',$1,'{"size":200,"mimetype":"video/mp4"}'),
  ('media','document',$1,'{"size":50,"mimetype":"text/plain"}'),
  ('media','invalid',$1,'{"size":"invalid"}'),
  ('media','unattributed',null,'{"size":9000}'),
  ('media','other',$2,'{"size":9000}')`,[a,b]);
async function as(user,role='authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  await db.exec('set role '+role);
}
await as(a);
await db.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values ('account-backups',$1,$2,'{\"size\":500}')",[a+'/snapshot.json',a]);
check((await db.query('select * from storage.objects')).rows.length===1,'owner sees own backup only');
for (const name of [b+'/snapshot.json',a+'/snapshot.exe']) {
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('account-backups',$1)",[name]),{code:'42501'});
  checks++; console.log('PASS denied upload',name.endsWith('.exe')?'non-JSON':'other account');
}
const usage=(await db.query('select public.my_attributed_storage_usage() as value')).rows[0].value;
assert.deepEqual(usage,{bytes:350,photos:100,videos:200,other:50,files:3,attribution:'verified-owner-only'});
checks++;console.log('PASS usage excludes other accounts, unattributed files and backup archives');
check((await db.query("update storage.objects set name='replaced.json' returning id")).rows.length===0,'immutable backups cannot be overwritten');
await as(b);
check((await db.query('select * from storage.objects')).rows.length===0,'other account cannot read backup');
check((await db.query('delete from storage.objects returning id')).rows.length===0,'other account cannot delete backup');
await as('', 'anon');
check((await db.query('select * from storage.objects')).rows.length===0,'anonymous backup read denied');
await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('account-backups','anonymous.json')"),{code:'42501'});
checks++; console.log('PASS anonymous backup upload denied');
await as(a);
check((await db.query('delete from storage.objects returning id')).rows.length===1,'owner can delete own backup');
await db.close();
console.log(`${checks} backup SQL checks passed; session SQL contract passed.`);
