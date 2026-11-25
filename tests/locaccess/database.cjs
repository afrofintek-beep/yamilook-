const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
create table auth.users(id uuid primary key,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid);
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql as $$ select jsonb_build_object('session_id',current_setting('test.sid',true)) $$;
create table public.profiles(id uuid primary key,username text,display_name text,avatar_url text,account_status text default 'active',country_code text default 'AO',afroloc_code text,afroloc_certification_status text default 'pending',latitude double precision,longitude double precision);
create table public.afroloc_experience_addresses(id uuid primary key,owner_id uuid,code text,status text,expires_at timestamptz,latitude double precision,longitude double precision);`);
await db.exec(fs.readFileSync('supabase/migrations/20261116162311_yamilook_locaccess_experimental.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261116181843_locaccess_recipient_search.sql','utf8'));
const ids=[1,2,3].map(i=>`00000000-0000-4000-8000-00000000000${i}`),sessions=[1,2,3].map(i=>`10000000-0000-4000-8000-00000000000${i}`);
for(let i=0;i<3;i++){await db.query('insert into auth.users(id) values($1)',[ids[i]]);await db.query('insert into auth.sessions values($1,$2)',[sessions[i],ids[i]]);await db.query('insert into profiles(id,username,afroloc_code,latitude,longitude) values($1,$2,$3,-8.9,13.2)',[ids[i],['owner','guest','other'][i],'AO-TEST-'+i]);}
const login=async i=>{await db.query("select set_config('test.uid',$1,false),set_config('test.sid',$2,false)",[ids[i],sessions[i]]);};
const action=async(a,d)=> {await db.exec('set role authenticated');try{return (await db.query('select public.locaccess_action($1,$2) as result',[a,JSON.stringify(d)])).rows[0].result}finally{await db.exec('reset role')}};
await login(0);await db.query("update profiles set display_name='António Ataíde',avatar_url='https://example.invalid/avatar.png' where id=$1",[ids[1]]);
for(const query of ['@guest','Ataide','ATAÍDE','antonio']){const people=await action('search',{query});ok(people.length===1&&people[0].id===ids[1],'search by name/username/accent');ok(Object.keys(people[0]).sort().join(',')==='avatar_url,display_name,id,username','public fields only');}
ok((await action('search',{query:'owner'})).length===0,'exclude self');ok((await action('search',{query:'a'})).length===0,'minimum two characters');ok((await action('search',{query:'%_'})).length===0,'wildcards are literal');
const source={id:'residence',code:'AO-TEST-0'};await login(0);let policy=await action('owner',source);ok(policy.enabled===false&&policy.grants.length===0,'closed by default');const handle=policy.handle;await assert.rejects(()=>action('grant',{...source,username:'guest',recipient_id:ids[2],radius:0,hours:24}));checks++;
ok((await db.query('select public.locaccess_reference_protected($1) as blocked',[source.code])).rows[0].blocked,'legacy public lookup blocked');
await db.exec('create table public.messages(id uuid primary key,sender_id uuid)');
await db.exec(fs.readFileSync('supabase/migrations/20261119034500_locaccess_farewells.sql','utf8'));
await db.exec(fs.readFileSync('supabase/migrations/20261123063333_locaccess_google_maps_entry.sql','utf8'));
const farewell=async(a,d)=>(await db.query('select public.locaccess_farewell($1,$2) as result',[a,JSON.stringify({...source,...d})])).rows[0].result;
for(const username of ['guest','other'])policy=await action('grant',{...source,username,radius:0,hours:24});
// Apply the new migration to actual legacy grants, not an empty schema.
const grantsSnapshot=async()=> (await db.query("select to_jsonb(g)-'offline_continuation' as value from locaccess_private.grants g order by id")).rows;
const securitySnapshot=async()=>({
 tables:(await db.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='locaccess_private' and c.relkind='r' order by c.relname")).rows,
 functions:(await db.query("select n.nspname,p.proname,p.prosecdef,p.proconfig,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where (n.nspname='locaccess_private' and p.proname in ('action','position')) or (n.nspname='public' and p.proname in ('locaccess_action','locaccess_reference_protected')) order by n.nspname,p.proname")).rows,
 policies:(await db.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='locaccess_private' order by tablename,policyname")).rows
});
const legacyGrants=await grantsSnapshot(),legacySecurity=await securitySnapshot();
ok(legacyGrants.length===2,'migration fixture contains two legacy grants');
await db.exec(fs.readFileSync('supabase/migrations/20261124170500_locaccess_offline_continuation.sql','utf8'));
assert.deepEqual(await grantsSnapshot(),legacyGrants,'migration preserves legacy expiry, revocation, radius and entrance');checks++;
assert.deepEqual(await securitySnapshot(),legacySecurity,'migration preserves RLS, ACLs, invoker wrapper and definer search path');checks++;
ok((await db.query('select offline_continuation from locaccess_private.grants')).rows.every(g=>g.offline_continuation===false),'legacy grants backfill to online-only');
const column=(await db.query("select is_nullable,column_default from information_schema.columns where table_schema='locaccess_private' and table_name='grants' and column_name='offline_continuation'")).rows[0];
ok(column.is_nullable==='NO'&&column.column_default==='false','new grant column is non-null and defaults false');
policy=await action('owner',source);ok(policy.grants.every(g=>g.offlineContinuation===false),'owner sees legacy consent as false');
const grantIds=policy.grants.map(g=>g.id);
await assert.rejects(()=>farewell('close',{grants:grantIds.slice(1),selected:grantIds}));
const closed=await farewell('close',{grants:grantIds,selected:[policy.grants.find(g=>g.username==='guest').id]});
ok(closed.pending.length===1&&closed.pending[0].id===ids[1],'only selected recipient retained');
ok((await action('owner',source)).grants.length===0,'closing revokes access for all guests');
ok((await farewell('list',{})).pending[0].message===closed.pending[0].message,'deferred delivery uses stable message ID');
await db.query('insert into messages values($1,$2)',[closed.pending[0].message,ids[0]]);
ok((await farewell('list',{})).pending.length===0,'completed delivery no longer pending');
await login(1);ok((await action('visit',{handle})).status==='denied','ungranted denied');
for(const radius of [100,250,500]){
 await login(0);policy=await action('grant',{...source,username:'guest',radius,hours:24});ok(policy.grants[0].radius===radius,'radius stored');
 await login(1);let result=await action('visit',{handle});ok(result.status==='proximity'&&!result.point&&!result.code,'GPS required without private point');
 const position={lat:-8.9,lon:13.2,accuracy:5,timestamp:Date.now()};result=await action('visit',{handle,position});ok(result.status==='ready'&&result.point.lat===-8.9,'inside radius');
 ok(Date.parse(result.expiresAt)-Date.now()<=21000,'bounded lease');
 for(const p of [{...position,lat:-8.8},{...position,accuracy:100},{...position,timestamp:Date.now()-30000},{...position,timestamp:Date.now()+60000}])ok((await action('visit',{handle,position:p})).status==='proximity','invalid location withheld');
}
await login(2);ok((await action('visit',{handle})).status==='denied','forwarded link not sufficient');
const entry={lat:-8.901,lon:13.201};
const visitingGrant={...source,username:'guest',radius:250,hours:24};
await login(0);
await assert.rejects(()=>action('grant',{...visitingGrant,google_entry:{lat:-8.9,lon:13.2}}),/diferente da morada/);checks++;
await assert.rejects(()=>action('grant',{...visitingGrant,google_entry:{lat:100,lon:13.2}}),/coordenadas válidas/);checks++;
policy=await action('grant',{...visitingGrant,google_entry:entry});
ok(policy.grants[0].hasExternalRoute,'owner can see that a grant includes an entrance');
ok((await action('external_route',{handle})).status==='denied','the owner view cannot retrieve a guest route');
await login(1);
const proximity=await action('visit',{handle});
ok(proximity.status==='proximity'&&proximity.hasExternalRoute&&!proximity.point&&!proximity.entryPoint,'visit flags the route without disclosing the entrance or residence');
const external=await action('external_route',{handle});
ok(external.status==='ready'&&Object.keys(external).sort().join(',')==='entryPoint,expiresAt,status','external route returns only entrance and lease');
assert.deepEqual(external.entryPoint,entry);checks++;
await login(2);ok((await action('external_route',{handle})).status==='denied','forwarded route denied');
await db.query("update locaccess_private.grants set expires_at=now()-interval '1 second' where handle=$1 and recipient_id=$2",[handle,ids[1]]);
await login(1);ok((await action('external_route',{handle})).status==='denied','expired route denied');
await login(0);policy=await action('grant',{...visitingGrant,google_entry:entry});
await action('revoke',{...source,grant_id:policy.grants[0].id});
await login(1);ok((await action('external_route',{handle})).status==='denied','revoked route denied');
await login(0);await action('grant',{...visitingGrant,google_entry:entry});await action('grant',visitingGrant);
await login(1);ok((await action('external_route',{handle})).status==='denied','re-authorizing without a Google Maps entrance removes the previous route');

// Consent is owned by the grant issuer and is strict JSON boolean data.
const offlineGrant={...source,username:'guest',radius:0,hours:24};
const storedGrant=async()=> (await db.query('select * from locaccess_private.grants where handle=$1 and recipient_id=$2',[handle,ids[1]])).rows[0];
await login(0);policy=await action('grant',{...offlineGrant,offline_continuation:true});
ok(policy.grants.find(g=>g.username==='guest').offlineContinuation===true,'owner can explicitly enable offline continuation');
ok((await storedGrant()).offline_continuation===true,'boolean true persists on the recipient grant');
const validOptIn=await storedGrant();
for(const invalid of ['true','false',1,0,null,{},[]]){
 await assert.rejects(()=>action('grant',{...offlineGrant,offline_continuation:invalid}),/Pedido inválido/);checks++;
 assert.deepEqual(await storedGrant(),validOptIn,'invalid consent cannot mutate or renew the grant');checks++;
}
await login(1);
ok((await action('visit',{handle,offline_continuation:false,offlineContinuation:'forbidden'})).offlineContinuation==='permitted','recipient cannot remove owner consent by changing visit data');
await assert.rejects(()=>action('grant',{...offlineGrant,owner_id:ids[0],offline_continuation:true}),/Endereço indisponível/);checks++;
assert.deepEqual(await storedGrant(),validOptIn,'recipient cannot grant itself owner consent');checks++;
await login(0);
ok((await action('visit',{handle,offline_continuation:true})).offlineContinuation==='forbidden','owner viewing does not auto-create offline consent');
policy=await action('grant',{...offlineGrant,offline_continuation:false});
ok(policy.grants.find(g=>g.username==='guest').offlineContinuation===false,'owner can explicitly disable continuation');
await login(1);
ok((await action('visit',{handle,offline_continuation:true,offlineContinuation:'permitted'})).offlineContinuation==='forbidden','visitor-supplied fields cannot enable offline continuation');
ok((await storedGrant()).offline_continuation===false,'visiting cannot mutate stored consent');
await login(0);await action('grant',{...offlineGrant,offline_continuation:true});policy=await action('grant',offlineGrant);
ok(policy.grants.find(g=>g.username==='guest').offlineContinuation===false,'regrant with consent omitted resets a former opt-in');
await login(1);ok((await action('visit',{handle})).offlineContinuation==='forbidden','omitted regrant is online-only for recipient');

// Expiry is authoritative for both states and is the minimum of response, grant
// and source lifetimes. Transaction now() makes the assertions deterministic.
const experience={id:'20000000-0000-4000-8000-000000000001',code:'AO-SYNTHETIC-OFFLINE'};
await db.query("insert into afroloc_experience_addresses(id,owner_id,code,status,expires_at,latitude,longitude) values($1,$2,$3,'approved',now()+interval '1 hour',-8.9,13.2)",[experience.id,ids[0],experience.code]);
await login(0);
let experiencePolicy=await action('grant',{...experience,username:'guest',radius:250,hours:24,offline_continuation:true});
const experienceHandle=experiencePolicy.handle;
const sourceDeadline=(await db.query('select expires_at from afroloc_experience_addresses where id=$1',[experience.id])).rows[0].expires_at;
ok(Date.parse(experiencePolicy.grants[0].expiresAt)===new Date(sourceDeadline).getTime(),'grant expiry cannot exceed source lifetime');
for(const scenario of [{name:'response cap',grant:120,source:120,expected:20},{name:'grant expiry',grant:5,source:120,expected:5},{name:'source expiry',grant:120,source:7,expected:7}]){
 await db.exec('begin');
 try{
  await db.query("update afroloc_experience_addresses set expires_at=now()+make_interval(secs=>$2) where id=$1",[experience.id,scenario.source]);
  await db.query("update locaccess_private.grants set expires_at=now()+make_interval(secs=>$2) where handle=$1",[experienceHandle,scenario.grant]);
  const serverNow=Number((await db.query('select extract(epoch from now())*1000 as ms')).rows[0].ms);
  await login(1);
  for(const hasPosition of [false,true]){
   const request={handle:experienceHandle,offline_continuation:false,expiresAt:'2099-01-01T00:00:00Z'};
   if(hasPosition)request.position={lat:-8.9,lon:13.2,accuracy:5,timestamp:Date.now()};
   const result=await action('visit',request);
   ok(result.status===(hasPosition?'ready':'proximity'),`${scenario.name}: expected proximity or ready state`);
   ok(result.offlineContinuation==='permitted',`${scenario.name}: stored consent alone determines mode`);
   ok(Math.abs(Date.parse(result.expiresAt)-(serverNow+scenario.expected*1000))<2,`${scenario.name}: authoritative minimum expiry in both states`);
   if(!hasPosition)ok(!result.point&&!result.entryPoint&&!result.code,`${scenario.name}: proximity withholds private location`);
  }
 }finally{await db.exec('rollback');}
}
await login(0);await action('grant',{...experience,username:'guest',radius:250,hours:24,offline_continuation:false});
await login(1);
const onlineProximity=await action('visit',{handle:experienceHandle,offlineContinuation:'permitted'});
ok(onlineProximity.status==='proximity'&&onlineProximity.offlineContinuation==='forbidden'&&Number.isFinite(Date.parse(onlineProximity.expiresAt)),'online-only proximity still carries server expiry');
const enableExperience=async()=>{await login(0);return action('grant',{...experience,username:'guest',radius:0,hours:24,offline_continuation:true});};
const assertDenied=async(message)=>{await login(1);assert.deepEqual(await action('visit',{handle:experienceHandle,offline_continuation:true}),{status:'denied'},message);checks++;};
experiencePolicy=await enableExperience();
await action('revoke',{...experience,grant_id:experiencePolicy.grants[0].id});await assertDenied('revocation overrides offline opt-in without leaking expiry or point');
await enableExperience();await action('close',experience);await assertDenied('closed address cannot be reopened by offline opt-in');
await enableExperience();await db.query("update locaccess_private.grants set expires_at=now()-interval '1 second' where handle=$1",[experienceHandle]);await assertDenied('expired grant denies even with stored consent');
await enableExperience();await db.query("update afroloc_experience_addresses set expires_at=now()-interval '1 second' where id=$1",[experience.id]);await assertDenied('expired source denies even with stored consent');
await db.query("update afroloc_experience_addresses set expires_at=now()+interval '1 hour' where id=$1",[experience.id]);
await enableExperience();await login(1);
for(const invalidSession of [sessions[0],'10000000-0000-4000-8000-000000000099']){
 await db.query("select set_config('test.sid',$1,false)",[invalidSession]);
 await assert.rejects(()=>action('visit',{handle:experienceHandle}),error=>error.code==='42501'&&error.message==='Volte a entrar na Yamilook.');checks++;
}
await login(1);
await db.query('update auth.users set is_anonymous=true where id=$1',[ids[1]]);
await assert.rejects(()=>action('visit',{handle:experienceHandle}),error=>error.code==='42501');checks++;
await db.query('update auth.users set is_anonymous=false where id=$1',[ids[1]]);
await db.query("update profiles set account_status='suspended' where id=$1",[ids[1]]);
await assert.rejects(()=>action('visit',{handle:experienceHandle}),error=>error.code==='42501');checks++;
await db.query("update profiles set account_status='active' where id=$1",[ids[1]]);
await db.exec('set role authenticated');
try{await assert.rejects(()=>db.query('update locaccess_private.grants set offline_continuation=true where handle=$1',[experienceHandle]),error=>error.code==='42501');checks++;}
finally{await db.exec('reset role');}
ok(!(await db.query("select has_column_privilege('authenticated','locaccess_private.grants','offline_continuation','update') as allowed")).rows[0].allowed,'authenticated cannot directly update new consent column');
ok((await db.query("select relrowsecurity from pg_class where oid in ('locaccess_private.addresses'::regclass,'locaccess_private.grants'::regclass)")).rows.every(row=>row.relrowsecurity),'RLS remains enabled on both private tables');
await db.exec('set role anon');
try{await assert.rejects(()=>db.query('select public.locaccess_action($1,$2)',['visit',JSON.stringify({handle:experienceHandle})]),error=>error.code==='42501');checks++;}
finally{await db.exec('reset role');}
ok(!(await db.query("select has_function_privilege('authenticated','locaccess_private.position(uuid,text,text)','execute') as allowed")).rows[0].allowed,'private position helper remains inaccessible');

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

// MAGUELA authorization is separate, owner-controlled, and contains no private point.
await db.exec(fs.readFileSync('supabase/migrations/20261125013000_locaccess_maguela_pickup.sql','utf8'));
await db.query("update profiles set afroloc_code=$1 where id=$2",[source.code,ids[0]]);
await db.query('insert into auth.sessions values($1,$2)',[sessions[1],ids[1]]);
const pickup=async(a,d)=>{await db.exec('set role authenticated');try{return (await db.query('select public.locaccess_maguela_pickup($1,$2) as result',[a,JSON.stringify(d)])).rows[0].result}finally{await db.exec('reset role')}};
await login(0);policy=await action('grant',{...source,username:'guest',radius:250,hours:24});
const grantId=policy.grants.find(g=>g.username==='guest').id, args={handle,grant_id:grantId}, ref='AO-PUBLIC-PORTARIA';
await login(1);ok((await pickup('resolve',{handle})).status==='denied','visit alone does not authorize pickup');
ok((await pickup('set',{...args,reference:ref})).status==='denied','recipient cannot self-authorize');
await login(0);
ok((await pickup('set',{...args,reference:source.code})).status==='denied','cannot designate protected residence');
ok((await pickup('set',{...args,reference:'https://example.invalid'})).status==='denied','no arbitrary URL');
ok((await pickup('set',{...args,reference:ref})).status==='designated','owner explicitly designates separate pickup');
await login(1);const result=await pickup('resolve',{handle});
ok(result.status==='ready'&&result.reference===ref,'authorized recipient receives designation');
ok(Object.keys(result).sort().join(',')==='expiresAt,reference,status','no private coordinates, code or identity');
ok(Date.parse(result.expiresAt)-Date.now()<=21000,'lookup expires within 20 seconds');
await login(2);ok((await pickup('resolve',{handle})).status==='denied','forwarded handle does not authorize');
await login(0);ok((await pickup('clear',args)).status==='cleared','owner removes pickup consent');
await login(1);ok((await pickup('resolve',{handle})).status==='denied','withdrawn consent denied');
await login(0);await pickup('set',{...args,reference:ref});await action('revoke',{...source,grant_id:grantId});
await login(1);ok((await pickup('resolve',{handle})).status==='denied','revoked visit invalidates pickup');
await login(0);await action('grant',{...source,username:'guest',radius:250,hours:24});
await db.query("update locaccess_private.grants set updated_at=updated_at+interval '1 second' where id=$1",[grantId]);
await login(1);ok((await pickup('resolve',{handle})).status==='denied','renewed grant does not inherit pickup consent');
await login(0);await pickup('set',{...args,reference:ref});
await db.query("update locaccess_private.grants set expires_at=now()-interval '1 second' where id=$1",[grantId]);
await login(1);ok((await pickup('resolve',{handle})).status==='denied','expired grant denied');
await login(0);await action('grant',{...source,username:'guest',radius:250,hours:24});await pickup('set',{...args,reference:ref});
await db.query("update profiles set afroloc_code='AO-CHANGED-AGAIN' where id=$1",[ids[0]]);
await login(1);ok((await pickup('resolve',{handle})).status==='denied','changed source denies pickup');
ok(!(await db.query("select has_table_privilege('authenticated','locaccess_private.maguela_pickups','select') as allowed")).rows[0].allowed,'no direct table reads');
ok(!(await db.query("select has_function_privilege('anon','public.locaccess_maguela_pickup(text,jsonb)','execute') as allowed")).rows[0].allowed,'anonymous denied');

console.log(`${checks} LOCACCESS database checks passed`);await db.close();})().catch(e=>{console.error(e.message);process.exit(1)});
