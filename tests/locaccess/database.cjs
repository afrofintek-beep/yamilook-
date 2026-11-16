const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('session_id',current_setting('test.sid',true)) $$;
create table public.profiles(id uuid primary key,username text,account_status text default 'active',country_code text default 'AO',afroloc_code text,afroloc_certification_status text default 'pending',latitude double precision,longitude double precision);
create table public.afroloc_experience_addresses(id uuid primary key,owner_id uuid,code text,status text,expires_at timestamptz,latitude double precision,longitude double precision);`);
await db.exec(fs.readFileSync('supabase/migrations/20261116162311_yamilook_locaccess_experimental.sql','utf8'));
const ids=[1,2,3].map(i=>`00000000-0000-4000-8000-00000000000${i}`),sessions=[1,2,3].map(i=>`10000000-0000-4000-8000-00000000000${i}`);
for(let i=0;i<3;i++){await db.query('insert into auth.users(id) values($1)',[ids[i]]);await db.query('insert into auth.sessions values($1,$2)',[sessions[i],ids[i]]);await db.query('insert into profiles(id,username,afroloc_code,latitude,longitude) values($1,$2,$3,-8.9,13.2)',[ids[i],['owner','guest','other'][i],'AO-TEST-'+i]);}
const login=async i=>{await db.query("select set_config('test.uid',$1,false),set_config('test.sid',$2,false)",[ids[i],sessions[i]]);};
const action=async(a,d)=> {await db.exec('set role authenticated');try{return (await db.query('select public.locaccess_action($1,$2) as result',[a,JSON.stringify(d)])).rows[0].result}finally{await db.exec('reset role')}};
const source={id:'residence',code:'AO-TEST-0'};await login(0);let policy=await action('owner',source);ok(policy.enabled===false&&policy.grants.length===0,'closed by default');const handle=policy.handle;
ok((await db.query('select public.locaccess_reference_protected($1) as blocked',[source.code])).rows[0].blocked,'legacy public lookup blocked');
await login(1);ok((await action('visit',{handle})).status==='denied','ungranted denied');
for(const radius of [100,250,500]){
 await login(0);policy=await action('grant',{...source,username:'guest',radius,hours:24});ok(policy.grants[0].radius===radius,'radius stored');
 await login(1);let result=await action('visit',{handle});ok(result.status==='proximity'&&!result.point&&!result.code,'GPS required without private point');
 const position={lat:-8.9,lon:13.2,accuracy:5,timestamp:Date.now()};result=await action('visit',{handle,position});ok(result.status==='ready'&&result.point.lat===-8.9,'inside radius');
 ok(Date.parse(result.expiresAt)-Date.now()<=21000,'bounded lease');
 for(const p of [{...position,lat:-8.8},{...position,accuracy:100},{...position,timestamp:Date.now()-30000},{...position,timestamp:Date.now()+60000}])ok((await action('visit',{handle,position:p})).status==='proximity','invalid location withheld');
}
await login(2);ok((await action('visit',{handle})).status==='denied','forwarded link not sufficient');
await login(0);policy=await action('grant',{...source,username:'guest',radius:0,hours:1});await login(1);ok((await action('visit',{handle})).status==='ready','immediate still authenticated');
await login(0);await action('revoke',{...source,grant_id:policy.grants[0].id});await login(1);ok((await action('visit',{handle})).status==='denied','revoked');
await login(0);await action('grant',{...source,username:'guest',radius:0,hours:24});await action('grant',{...source,username:'other',radius:0,hours:24});await action('close',source);
for(const i of [1,2]){await login(i);ok((await action('visit',{handle})).status==='denied','close revokes all');}
await login(0);await action('grant',{...source,username:'guest',radius:0,hours:24});await login(2);ok((await action('visit',{handle})).status==='denied','reopening does not resurrect others');
await login(0);await db.query("update profiles set username='GUEST' where id=$1",[ids[2]]);await assert.rejects(()=>action('grant',{...source,username:'guest',radius:0,hours:24}));checks++;await db.query("update profiles set username='other' where id=$1",[ids[2]]);await assert.rejects(()=>action('grant',{...source,username:'guest',radius:99,hours:24}));checks++;
await login(1);await assert.rejects(()=>action('owner',source));checks++;
await login(0);await db.query("update profiles set afroloc_code='AO-CHANGED' where id=$1",[ids[0]]);await login(1);ok((await action('visit',{handle})).status==='denied','changed address invalidates access');
await db.query('delete from auth.sessions where id=$1',[sessions[1]]);await assert.rejects(()=>action('visit',{handle}));checks++;
ok(!(await db.query("select has_function_privilege('anon','public.locaccess_action(text,jsonb)','execute') as allowed")).rows[0].allowed,'anonymous cannot invoke');
ok(!(await db.query("select has_table_privilege('authenticated','locaccess_private.addresses','select') as allowed")).rows[0].allowed,'table not exposed');
ok(!(await db.query("select has_function_privilege('authenticated','public.locaccess_reference_protected(text)','execute') as allowed")).rows[0].allowed,'cannot enumerate protected codes');
console.log(`${checks} LOCACCESS database checks passed`);await db.close();})().catch(e=>{console.error(e.message);process.exit(1)});
