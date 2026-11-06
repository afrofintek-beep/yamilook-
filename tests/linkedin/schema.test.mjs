import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('migration denies browser access and atomically claims publication only once', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); create table public.posts(id uuid primary key);`);
    await db.exec(await readFile(new URL('../../supabase/migrations/20261106193216_linkedin_direct_publishing.sql', import.meta.url), 'utf8'));
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of ['linkedin_connections','linkedin_oauth_states','linkedin_drafts','linkedin_upload_parts']) await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
      await db.exec('reset role');
    }
    const policies = await db.query("select relname, relrowsecurity from pg_class where relname in ('linkedin_connections','linkedin_oauth_states','linkedin_drafts','linkedin_upload_parts')");
    assert.equal(policies.rows.length, 4); assert.ok(policies.rows.every(row => row.relrowsecurity));
    await db.exec(`insert into auth.users values ('11111111-1111-4111-8111-111111111111'); insert into public.posts values ('22222222-2222-4222-8222-222222222222');
      insert into public.linkedin_drafts(user_id,post_id,post_fingerprint,subject,media_type,media_urn,size,status) values ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','hash','member','image/png','urn:li:image:1',4,'ready');
      set role service_role;`);
    const claim = "update public.linkedin_drafts set status='publishing' where status='ready' returning id";
    const results = await Promise.all([db.query(claim), db.query(claim)]);
    assert.equal(results.reduce((n,r) => n+r.rows.length,0),1);
  } finally { await db.close(); }
});
