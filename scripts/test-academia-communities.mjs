import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
test('Academia communities: enrollment, public consent and private evidence',async t=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table public.profiles(id uuid primary key,display_name text);
   create table public.mentor_profiles(user_id uuid primary key references public.profiles(id));
   insert into public.profiles select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Pessoa '||n from generate_series(1,6)n;
   insert into public.mentor_profiles select id from public.profiles where display_name in ('Pessoa 1','Pessoa 6');`);
  for(const file of ['20261029113425_academia_learning_results.sql','20261029123434_academia_communities.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const as=async(n,role='authenticated')=>{await db.exec('reset role;set role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);};
  const action=async(name,target=null,payload={})=>(await db.query('select public.academia_community_action($1,$2,$3::jsonb) id',[name,target,JSON.stringify(payload)])).rows[0].id;
  const learning=async(name,target,payload={})=>(await db.query('select public.academia_learning_action($1,$2,$3::jsonb) id',[name,target,JSON.stringify(payload)])).rows[0].id;
  const group={community_slug:'criacao-digital',title:'Criar a primeira apresentação',plan:'Vamos preparar e avaliar uma apresentação digital.',challenge_title:'Criar um cartaz',instructions:'Entrega um cartaz com uma mensagem clara.',skill:'Comunicação digital',capacity:2};
  let cohort,goal,challenge,work;
  await t.test('six public communities are real catalog entries; anonymous writes and private data are denied',async()=>{
   await as(null,'anon');assert.equal((await db.query('select * from public.academia_communities')).rows.length,6);
   await assert.rejects(action('cohort_create',null,group),/permission denied/);
   await assert.rejects(db.query('select * from public.academia_work_sources'),/permission denied/);
   await assert.rejects(db.query('select * from public.academia_cohort_members'),/permission denied/);
  });
  await t.test('only mentors publish cohorts, and capacity is bounded on the server',async()=>{
   await as(2);await assert.rejects(action('cohort_create',null,{...group,mentor_id:id(1)}),/Apenas um mentor/);
   await as(1);await assert.rejects(action('cohort_create',null,{...group,capacity:21}),/check constraint/);
   cohort=await action('cohort_create',null,group);
   await assert.rejects(action('cohort_join',cohort),/própria turma/);
  });
  await t.test('joining creates one private active goal and challenge, and retries do not consume seats',async()=>{
   await as(2);goal=await action('cohort_join',cohort,{learner_id:id(3)});
   assert.equal(await action('cohort_join',cohort),goal);
   const g=(await db.query('select * from public.academia_goals where id=$1',[goal])).rows[0];
   assert.equal(g.learner_id,id(2));assert.equal(g.status,'active');assert.equal(g.plan,group.plan);
   challenge=(await db.query('select id from public.academia_challenges where goal_id=$1',[goal])).rows[0].id;
   assert.equal((await db.query('select seats_taken from public.academia_cohorts where id=$1',[cohort])).rows[0].seats_taken,1);
  });
  await t.test('another learner can discover the cohort but cannot see its roster or private work',async()=>{
   await as(3);assert.equal((await db.query('select * from public.academia_cohorts')).rows.length,1);
   assert.equal((await db.query('select * from public.academia_goals where id=$1',[goal])).rows.length,0);
   assert.equal((await db.query('select * from public.academia_cohort_members')).rows.length,0);
   assert.equal((await db.query('select * from public.academia_community_audit')).rows.length,0);
  });
  await t.test('publication requires explicit consent, ownership and mentor validation',async()=>{
   await as(2);await assert.rejects(action('work_publish',challenge,{caption:'O meu cartaz'}),/Confirma/);
   await assert.rejects(action('work_publish',challenge,{caption:'O meu cartaz',consent:true}),/validar o trabalho/);
   const s=await learning('submit',goal,{challenge_id:challenge,content:'PRIVATE_SUBMISSION_DETAIL',evidence_url:'https://example.org/reviewed-evidence'});
   await as(1);await learning('review',goal,{challenge_id:challenge,submission_id:s,decision:'approved',feedback:'PRIVATE_MENTOR_FEEDBACK'});
   await assert.rejects(action('work_publish',challenge,{caption:'Indevido',consent:true}),/Apenas o aluno/);
   await as(2);work=await action('work_publish',challenge,{caption:'Preparei o meu primeiro cartaz.',consent:true,include_evidence:false,evidence_url:'https://example.org/unreviewed',community_slug:'musica-expressao'});
   assert.equal((await db.query('select * from public.academia_work_sources')).rows.length,1);
  });
  await t.test('the public snapshot contains no private account IDs, submissions or feedback',async()=>{
   await as(null,'anon');const row=(await db.query('select * from public.academia_public_works where id=$1',[work])).rows[0];
   assert.equal(row.community_slug,'criacao-digital');assert.equal(row.evidence_url,null);assert.equal(row.learner_name,'Pessoa 2');
   assert.ok(!JSON.stringify(row).includes('PRIVATE_'));assert.ok(!JSON.stringify(row).includes(id(2)));
   for(const field of ['owner_id','learner_id','goal_id','challenge_id','content','feedback'])assert.ok(!(field in row));
   await assert.rejects(db.query('select * from public.academia_goals where id=$1',[goal]),/permission denied/);
  });
  await t.test('only the learner can withdraw, and withdrawing removes public access immediately',async()=>{
   await as(3);await assert.rejects(action('work_hide',work),/Não tens acesso/);
   await assert.rejects(db.query('update public.academia_public_works set published=false where id=$1',[work]),/permission denied/);
   await as(2);await action('work_hide',work);
   assert.equal((await db.query('select * from public.academia_public_works where id=$1',[work])).rows.length,1);
   await as(null,'anon');assert.equal((await db.query('select * from public.academia_public_works where id=$1',[work])).rows.length,0);
  });
  await t.test('republishing keeps the same proof ID and includes only the evaluated link when opted in',async()=>{
   await as(2);assert.equal(await action('work_publish',challenge,{caption:'Quero mostrar o meu trabalho.',consent:true,include_evidence:true,evidence_url:'https://example.org/unreviewed'}),work);
   await as(null,'anon');const row=(await db.query('select * from public.academia_public_works where id=$1',[work])).rows[0];
   assert.equal(row.evidence_url,'https://example.org/reviewed-evidence');
  });
  await t.test('a shared proof can lead to enrollment without exposing other learners',async()=>{
   await as(3);const second=await action('cohort_join',cohort,{source_work_id:work});
   const rows=(await db.query('select * from public.academia_cohort_members')).rows;
   assert.equal(rows.length,1);assert.equal(rows[0].source_work_id,work);assert.equal(rows[0].goal_id,second);
   assert.equal((await db.query('select * from public.academia_goals where id=$1',[goal])).rows.length,0);
   await as(1);assert.equal((await db.query('select * from public.academia_cohort_members')).rows.length,2);
   assert.equal((await db.query('select * from public.academia_cohort_members where source_work_id=$1',[work])).rows.length,1);
  });
  await t.test('full and closed cohorts reject new entries while enrolled learners retain their goals',async()=>{
   await as(4);await assert.rejects(action('cohort_join',cohort),/esgotadas/);
   await assert.rejects(action('cohort_close',cohort),/Apenas o mentor/);
   await as(1);await action('cohort_close',cohort);
   await as(2);assert.equal(await action('cohort_join',cohort),goal);
   assert.equal((await db.query('select * from public.academia_challenges where goal_id=$1',[goal])).rows.length,1);
  });
  await t.test('the shared five-goal limit applies across personal and cohort journeys',async()=>{
   await as(2);for(let n=0;n<4;n++)await learning('create',null,{mentor_id:id(1),title:'Outro objetivo '+n});
   await as(1);const other=await action('cohort_create',null,group);
   await as(2);await assert.rejects(action('cohort_join',other),/cinco percursos/);
   assert.equal((await db.query('select seats_taken from public.academia_cohorts where id=$1',[other])).rows[0].seats_taken,0);
  });
  await t.test('mentor open-cohort limits and RLS/direct write protections are enforced',async()=>{
   await as(1);await action('cohort_create',null,group);await action('cohort_create',null,group);
   await assert.rejects(action('cohort_create',null,group),/três turmas/);
   await db.exec('reset role');
   const tables=['academia_communities','academia_cohorts','academia_public_works','academia_work_sources','academia_cohort_members','academia_community_audit'];
   const rows=(await db.query('select relname,relrowsecurity from pg_class where relname=any($1)',[tables])).rows;
   assert.equal(rows.length,6);assert.ok(rows.every(r=>r.relrowsecurity));
   for(const table of tables)assert.equal((await db.query("select has_table_privilege('authenticated',$1,'INSERT') allowed",['public.'+table])).rows[0].allowed,false);
  });
 }finally{await db.close();}
});
