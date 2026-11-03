import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const migration=await readFile(new URL('../../supabase/migrations/20261103103824_normalize_public_profile_lookup.sql',import.meta.url),'utf8');
test('anonymous lookup resolves clean, padded and mixed-case usernames without exposing private data', async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon;
      create table public.profiles(id uuid primary key, username text unique, display_name text, avatar_url text, bio text, status_message text, afroloc_code text, afroloc_certification_status text, is_creator boolean, founder_number int, created_at timestamptz, email text, latitude float, longitude float, phone_number text);
      alter table public.profiles enable row level security;
      create function public.get_public_profile(p_username text) returns json language sql security definer set search_path=public as $$ select null::json $$;
      revoke all on function public.get_public_profile(text) from public; grant execute on function public.get_public_profile(text) to anon;
      insert into public.profiles(id,username,display_name,afroloc_code,email,phone_number,latitude,longitude) values('11111111-1111-1111-1111-111111111111','tony_dinguanza ','Tony','private-code','private@example.com','private-phone',1,2);`);
    await db.exec(migration);
    await assert.rejects(db.exec("insert into public.profiles(id,username) values('22222222-2222-2222-2222-222222222222','TONY_DINGUANZA')"), /duplicate key/);
    await db.exec('set role anon');
    for(const username of ['tony_dinguanza',' tony_dinguanza ','TONY_DINGUANZA']) {
      const {rows}=await db.query('select public.get_public_profile($1) as profile',[username]);
      assert.equal(rows[0].profile.username,'tony_dinguanza');assert.equal(rows[0].profile.display_name,'Tony');assert.equal(rows[0].profile.afroloc_code,null);
      for(const key of ['email','phone_number','latitude','longitude']) assert.equal(key in rows[0].profile,false);
    }
    assert.equal((await db.query("select public.get_public_profile('missing') as profile")).rows[0].profile,null);
    await assert.rejects(db.query('select * from public.profiles'), /permission denied/);
  } finally {await db.close();}
});
