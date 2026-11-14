import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
test('isolated ownership, persistence, code, review and revocation',async()=>{
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,is_anonymous boolean default false);create table auth.sessions(id uuid,user_id uuid);
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select jsonb_build_object('session_id',current_setting('test.session',true))$$;
 create table public.profiles(id uuid primary key,country_code text);
 create function public.is_moderator_or_admin(id uuid) returns boolean language sql as $$select id='00000000-0000-4000-8000-000000000003'::uuid$$;
 create table public.afroloc_official_divisions(code text,level int,name text,parent_code text);
 insert into public.afroloc_official_divisions values ('AO-LDA',1,'Luanda',null),('AO-LDA-TAL',2,'Talatona','AO-LDA'),('AO-LDA-KTA',3,'Talatona','AO-LDA-TAL');
 `);
 // Use the existing production generator definition without profile trigger migrations.
 const codec=await readFile('supabase/migrations/20261109040752_align_afroloc_official_codec.sql','utf8');
 const first=codec.indexOf('create or replace function public.afroloc_b36_signed');
 const end=codec.indexOf('create or replace function public.set_afroloc_code');
 await db.exec(codec.slice(first,end));
 await db.exec(await readFile('docs/database/yamilook-afroloc-experience.sql','utf8'));
 const ids=[1,2,3].map(n=>'00000000-0000-4000-8000-00000000000'+n);const sessions=[1,2,3].map(n=>'10000000-0000-4000-8000-00000000000'+n);
 for(let i=0;i<3;i++)await db.query('insert into auth.users(id) values($1);',[ids[i]]);
 for(let i=0;i<3;i++){await db.query('insert into auth.sessions values($1,$2)',[sessions[i],ids[i]]);await db.query("insert into profiles values($1,'AO')",[ids[i]])}
 const login=async(i)=>{await db.query("select set_config('test.uid',$1,false),set_config('test.session',$2,false)",[ids[i],sessions[i]])};
 const call=async(action,data={})=>(await db.query('select public.afroloc_experience_action($1,$2) as data',[action,JSON.stringify(data)])).rows[0].data;
 await login(0);const input={id:'20000000-0000-4000-8000-000000000001',label:'Teste',province:'AO-LDA',municipality:'AO-LDA-TAL',commune:'AO-LDA-KTA',neighborhood:'Zona de teste',latitude:-8.89912,longitude:13.20534,consent:true};
 await assert.rejects(call('create',{...input,consent:undefined}));
 const created=await call('create',input);assert.equal(created.code,'AO-LDA-TAL-KTA-DIG-G10-35FD-N24QY');await call('create',input);assert.equal((await call('list')).addresses.length,1);
 assert.equal((await call('position',{id:input.id})).point.lat,input.latitude);
 await login(1);assert.equal((await call('list')).addresses.length,0);await assert.rejects(call('position',{id:input.id}));await assert.rejects(call('close',{id:input.id}));await assert.rejects(call('queue'));
 await login(2);assert.equal((await call('queue')).addresses.length,1);await call('review',{id:input.id,decision:'approved',confirmed:true,note:'Revisão sintética para teste'});
 await login(0);assert.equal((await call('list')).addresses[0].status,'approved');await call('close',{id:input.id});await assert.rejects(call('position',{id:input.id}));
 await db.query('delete from auth.sessions where id=$1',[sessions[0]]);await assert.rejects(call('list'));
 await db.close();
});
