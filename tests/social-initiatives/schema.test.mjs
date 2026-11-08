import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const migrations = readdirSync(new URL('supabase/migrations/', root));
const db = new PGlite();
const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const slug = 'natal-solidario-talatona-2026';
async function call(action, payload={}, actor=2, initiative=slug) {
  await db.exec(`SET ROLE ${actor ? 'authenticated' : 'anon'}; SET request.jwt.claim.sub='${actor ? uid(actor) : ''}'`);
  try {
    const result = await db.query('select public.social_initiative_action($1,$2,$3::jsonb) result', [action,initiative,JSON.stringify(payload)]);
    return result.rows[0].result;
  } finally { await db.exec("RESET ROLE; SET request.jwt.claim.sub=''"); }
}
async function review(n,approved=true,condominium='adelaide') {
 return call('review',{user_id:uid(n),approved,expected_code:`AO-TEST-${n}`,valid_until:'2099-01-01T00:00:00Z',evidence_reference:'review-test-0001',verified_condominium:condominium},1);
}
await db.exec(read('tests/invitation-campaigns/bootstrap.sql'));
await db.exec('ALTER TABLE public.profiles ADD COLUMN afroloc_code text');
for (const suffix of ['single_use_invitations','mvp_invitation_permissions','shareable_contact_invitations','controlled_invitation_campaigns','social_initiatives']) {
 await db.exec(read(`supabase/migrations/${migrations.find(path=>path.endsWith(`_${suffix}.sql`))}`));
}
await db.exec("SET session_replication_role=replica");
for(let n=1;n<=10;n++) {
 await db.query("INSERT INTO auth.users(id,email,created_at,last_sign_in_at,email_confirmed_at) VALUES($1,$2,now(),now(),now())",[uid(n),`user${n}@example.com`]);
 await db.query("INSERT INTO profiles(id,email,display_name,afroloc_code) VALUES($1,$2,$3,$4)",[uid(n),`user${n}@example.com`,`User ${n}`,`AO-TEST-${n}`]);
}
await db.exec("SET session_replication_role=origin");
await db.query("INSERT INTO user_roles VALUES($1,'admin')",[uid(1)]);
const config={status:'active',starts_at:'2020-01-01T00:00:00Z',ends_at:'2099-01-01T00:00:00Z',capacity:100,goal_invites:5,require_attendance:true};

await test('catalog is public but registrations and administrative writes are protected',async()=>{
 assert.equal((await call('catalog',{},0)).condominiums.length,32);
 await assert.rejects(call('register',{},0),/Autenticação/);
 await assert.rejects(call('configure',config,2),/administrador/);
 await call('configure',config,1);
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${uid(2)}'`);
 await assert.rejects(db.query('select * from social_registrations'),/permission denied/);
 await assert.rejects(db.query("insert into social_distinctions(initiative,user_id) values($1,$2)",[slug,uid(2)]),/permission denied/);
 await db.exec('RESET ROLE');
});
await test('registration is idempotent and needs address and consent',async()=>{
 await assert.rejects(call('register',{condominium_id:'adelaide'}),/Confirma/);
 await call('register',{condominium_id:'adelaide',consent:true});
 await call('register',{condominium_id:'adelaide',consent:true});
 assert.equal((await db.query('select count(*)::int n from social_registrations')).rows[0].n,1);
 await assert.rejects(call('issue',{request_id:uid(300)}),/validação/);
 await review(2);
});
const codes=[];
await test('five unique invitations, retry-safe quota and blocked sixth invitation',async()=>{
 for(let n=0;n<5;n++) codes.push((await call('issue',{request_id:uid(300+n)})).code);
 assert.equal(new Set(codes).size,5);
 assert.equal((await call('issue',{request_id:uid(300)})).code,codes[0]);
 await assert.rejects(call('issue',{request_id:uid(305)}),/cinco/);
});
await test('generic issuance cannot bypass five even if campaign settings are changed',async()=>{
 const campaign=(await db.query('select campaign_id from social_initiatives where slug=$1',[slug])).rows[0].campaign_id;
 await db.query('update invitation_campaigns set max_per_user=10 where id=$1',[campaign]);
 await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${uid(2)}'`);
 try { await assert.rejects(db.query('select public.issue_campaign_invitation($1,$2,NULL)',[campaign,uid(399)]),/cinco/); }
 finally { await db.exec('RESET ROLE'); }
 await db.query('update invitation_campaigns set max_per_user=5 where id=$1',[campaign]);
});
await test('existing members accept once; mismatched neighbourhoods do not count',async()=>{
 for(let n=3;n<=7;n++) {
  await call('register',{condominium_id:'adelaide',consent:true,invite_code:codes[n-3]},n);
  await review(n,true,n===7?'candando':'adelaide');
 }
 assert.equal((await call('dashboard')).completed_invites,4);
 assert.equal((await call('dashboard')).awarded,false);
 await assert.rejects(call('register',{condominium_id:'adelaide',consent:true,invite_code:codes[0]},8),/indisponível/);
 await review(7);
 assert.equal((await call('dashboard')).completed_invites,5);
 assert.equal((await call('dashboard')).awarded,false);
});
await test('attendance cannot be confirmed before the event',async()=>{
 await db.exec("UPDATE social_initiatives SET event_starts_on=DATE '2099-01-01'");
 await assert.rejects(call('attendance',{user_id:uid(2),approved:true},1),/ainda não começou/);
});
await db.exec("UPDATE social_initiatives SET event_starts_on=DATE '2020-01-01'");
await test('attendance triggers exactly one distinction and visibility is explicit',async()=>{
 await call('attendance',{user_id:uid(2),approved:true},1);
 await call('attendance',{user_id:uid(2),approved:true},1);
 assert.equal((await call('dashboard')).awarded,true);
 assert.equal((await db.query('select count(*)::int n from social_distinctions')).rows[0].n,1);
 assert.equal((await call('profile',{user_id:uid(2)},0)).initiatives.length,0);
 await call('visibility',{is_public:true});
 assert.equal((await call('profile',{user_id:uid(2)},0)).initiatives[0].awarded,true);
});
await test('revocation corrects awards; later address changes and expiry only invalidate current progress',async()=>{
 await review(7,false);
 assert.equal((await call('dashboard')).awarded,false);
 await review(7);
 assert.equal((await call('dashboard')).awarded,true);
 await db.query('update profiles set afroloc_code=$1 where id=$2',['AO-CHANGED-7',uid(7)]);
 assert.equal((await call('profile',{user_id:uid(2)},0)).initiatives[0].awarded,true);
 await db.query('update profiles set afroloc_code=$1 where id=$2',['AO-TEST-7',uid(7)]);
 await db.query("update social_registrations set valid_until=now()-interval '1 second' where user_id=$1",[uid(7)]);
 assert.equal((await call('dashboard')).completed_invites,4);
 await review(7);
 assert.equal((await db.query('select count(*)::int n from social_distinctions')).rows[0].n,1);
});
await test('real signup trigger consumes the social invitation; signup alone is not an event registration',async()=>{
 // Participant 3 can invite after their independent residence review, even if
 // their account was created after the initiative's campaign.
 const code=(await call('issue',{request_id:uid(400)},3)).code;
 await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",[uid(11),'new@example.com',JSON.stringify({access_code:code})]);
 const invite=(await db.query('select used_by from user_invitations where code=$1',[code])).rows[0];
 assert.equal(invite.used_by,uid(11));
 assert.equal((await db.query('select count(*)::int n from social_registrations where user_id=$1',[uid(11)])).rows[0].n,0);
 await assert.rejects(db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)",[uid(12),'another@example.com',JSON.stringify({access_code:code})]),/utilizado/);
});
await test('self-validation and over-capacity registrations are refused',async()=>{
 await call('register',{condominium_id:'adelaide',consent:true},1);
 await assert.rejects(review(1),/Outro administrador/);
 await call('configure',{...config,capacity:7},1);
 await assert.rejects(call('register',{condominium_id:'adelaide',consent:true},8),/Limite de participantes/);
 await call('configure',config,1);
});
await test('suspension blocks issue and registration and goals cannot change after enrolment',async()=>{
 await assert.rejects(call('configure',{...config,goal_invites:4},1),/metas/);
 await call('configure',{...config,status:'suspended'},1);
 await assert.rejects(call('issue',{request_id:uid(401)},3),/suspensa/);
 await assert.rejects(call('register',{condominium_id:'adelaide',consent:true},8),/fechadas/);
});
await db.close();
