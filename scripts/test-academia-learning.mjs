import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
// Real Postgres (WASM), isolated from production. Only the existing dependency
// tables and auth.uid() are stubbed; the entire new migration runs unchanged.
test('Academia learning migration and role isolation', async t => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;
      create table public.profiles(id uuid primary key);
      create table public.mentor_profiles(user_id uuid primary key references public.profiles(id));
      insert into public.profiles select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,4)n;
      insert into public.mentor_profiles select id from public.profiles where id::text in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000004');`);
    const migration = await readFile(new URL('../supabase/migrations/20261029110218_academia_learning_results.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    const mentor = '00000000-0000-4000-8000-000000000001', learner = '00000000-0000-4000-8000-000000000002', outsider = '00000000-0000-4000-8000-000000000003';
    const as = async (user, role = 'authenticated') => { await db.exec(`reset role; set role ${role}`); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']); };
    const action = async (name, goal = null, payload = {}) => (await db.query('select public.academia_learning_action($1,$2,$3::jsonb) id', [name,goal,JSON.stringify(payload)])).rows[0].id;
    const count = async table => Number((await db.query(`select count(*) n from public.${table}`)).rows[0].n);
    let goal, challenge, submission;
    await t.test('anonymous callers cannot execute either API entry point',async()=>{
      await as(null,'anon');
      await assert.rejects(action('create'),/permission denied/);
      await assert.rejects(db.query("select private.academia_learning_action('create')"),/permission denied/);
      await as(null);await assert.rejects(action('create'),/Inicia sessão/);
    });
    await t.test('only the signed-in learner can create a request with an existing distinct mentor',async()=>{
      await as(learner);
      await assert.rejects(action('create',null,{mentor_id:learner,title:'Objetivo inválido'}),/mentor válido/);
      await assert.rejects(action('create',null,{mentor_id:outsider,title:'Objetivo inválido'}),/mentor válido/);
      goal=await action('create',null,{mentor_id:mentor,title:'Da ideia à primeira venda',context:'Criar um catálogo'});
      assert.equal(await count('academia_goals'),1);
      await assert.rejects(db.query("update public.academia_goals set status='completed' where id=$1",[goal]),/permission denied/);
      await assert.rejects(db.query("insert into public.academia_goals(learner_id,mentor_id,title) values($1,$2,'Forjado')",[learner,mentor]),/permission denied/);
    });
    await t.test('outsiders cannot read goals, audit or mutate known IDs',async()=>{
      await as(outsider);assert.equal(await count('academia_goals'),0);assert.equal(await count('academia_learning_audit'),0);
      await assert.rejects(action('plan',goal,{plan:'Plano indevido'}),/Não tens acesso/);
    });
    await t.test('learner cannot accept a request or add challenges',async()=>{
      await as(learner);
      await assert.rejects(action('plan',goal,{plan:'Plano indevido'}),/Apenas o mentor/);
      await assert.rejects(action('challenge',goal,{title:'Forjado'}),/Apenas o mentor/);
    });
    await t.test('mentor accepts and creates the starter template only once',async()=>{
      await as(mentor);assert.equal(await count('academia_goals'),1);
      await assert.rejects(action('challenge',goal,{title:'Antes do plano'}),/define primeiro o plano/);
      await action('plan',goal,{plan:'Vamos preparar a tua oferta, custos e apresentação.',template:'first_sale'});
      await action('plan',goal,{plan:'Plano atualizado de acompanhamento.',template:'first_sale'});
      assert.equal(await count('academia_challenges'),3);
      assert.deepEqual((await db.query('select position from public.academia_challenges order by position')).rows.map(r=>r.position),[1,2,3]);
      challenge=(await db.query('select id from public.academia_challenges where goal_id=$1 order by created_at,id limit 1',[goal])).rows[0].id;
      await assert.rejects(action('complete',goal),/Valida todos/);
    });
    await t.test('outsiders cannot read challenges or submissions and cannot submit',async()=>{
      await as(outsider);assert.equal(await count('academia_challenges'),0);assert.equal(await count('academia_submissions'),0);
      assert.equal((await db.query('select * from public.academia_learning_progress($1::uuid[])',[[goal]])).rows.length,0);
      await assert.rejects(action('submit',goal,{challenge_id:challenge,content:'Forjado'}),/Não tens acesso/);
    });
    await t.test('mentor cannot submit as learner; text and evidence URLs are validated',async()=>{
      await as(mentor);await assert.rejects(action('submit',goal,{challenge_id:challenge,content:'Forjado'}),/Apenas o aluno/);
      await as(learner);
      await assert.rejects(action('submit',goal,{challenge_id:challenge,content:'ok'}),/check constraint/);
      await assert.rejects(action('submit',goal,{challenge_id:challenge,content:'Trabalho',evidence_url:'javascript:alert(1)'}),/check constraint/);
      submission=await action('submit',goal,{challenge_id:challenge,content:'Primeira versão',evidence_url:'https://example.org/catalogo'});
      await assert.rejects(action('submit',goal,{challenge_id:challenge,content:'Duplicado'}),/Aguarda a avaliação/);
    });
    await t.test('learner cannot self-approve or tamper with submissions directly',async()=>{
      await assert.rejects(action('review',goal,{challenge_id:challenge,submission_id:submission,decision:'approved',feedback:'Eu aprovo'}),/Apenas o mentor/);
      await assert.rejects(db.query("update public.academia_submissions set status='approved' where id=$1",[submission]),/permission denied/);
      await assert.rejects(action('complete',goal),/Apenas o mentor/);
    });
    await t.test('revision history is preserved and an old review cannot approve a new delivery',async()=>{
      await as(mentor);await action('review',goal,{challenge_id:challenge,submission_id:submission,decision:'revision',feedback:'Revê os custos'});
      await as(learner);const revised=await action('submit',goal,{challenge_id:challenge,content:'Custos corrigidos'});
      await as(mentor);
      await assert.rejects(action('review',goal,{challenge_id:challenge,submission_id:submission,decision:'approved',feedback:'Versão antiga'}),/já foi avaliada/);
      await action('review',goal,{challenge_id:challenge,submission_id:revised,decision:'approved',feedback:'Custos bem calculados'});
      const history=(await db.query('select status from public.academia_submissions where challenge_id=$1',[challenge])).rows.map(x=>x.status).sort();
      assert.deepEqual(history,['approved','revision']);
      await as(learner);await assert.rejects(action('submit',goal,{challenge_id:challenge,content:'Alteração indevida'}),/Aguarda a avaliação/);
    });
    await t.test('completion requires every challenge approved and then freezes all work',async()=>{
      await as(mentor);await assert.rejects(action('complete',goal),/Valida todos/);
      const rest=(await db.query("select id from public.academia_challenges where goal_id=$1 and status<>'approved'",[goal])).rows;
      for(const c of rest){await as(learner);const id=await action('submit',goal,{challenge_id:c.id,content:'Entrega completa'});await as(mentor);await action('review',goal,{challenge_id:c.id,submission_id:id,decision:'approved',feedback:'Trabalho validado'});}
      await action('complete',goal);
      assert.equal((await db.query('select status from public.academia_goals where id=$1',[goal])).rows[0].status,'completed');
      await assert.rejects(action('plan',goal,{plan:'Alteração depois da conclusão'}),/encerrado/);
      await as(learner);await assert.rejects(action('cancel',goal,{reason:'Cancelar depois de concluído'}),/encerrado/);
    });
    await t.test('all successful actions have an immutable audit entry visible only to participants',async()=>{
      await as(learner);assert.ok(await count('academia_learning_audit')>=12);
      await assert.rejects(db.query('delete from public.academia_learning_audit'),/permission denied/);
      await as(outsider);assert.equal(await count('academia_learning_audit'),0);
    });
    await t.test('pending request limits and cancellation are enforced by the server',async()=>{
      await as(learner);const ids=[];
      for(let i=0;i<5;i++)ids.push(await action('create',null,{mentor_id:mentor,title:`Objetivo número ${i}`}));
      await assert.rejects(action('create',null,{mentor_id:mentor,title:'Sexto objetivo'}),/cinco percursos/);
      await action('cancel',ids[0],{reason:'Já não pretendo continuar'});
      assert.equal((await db.query('select closure_reason from public.academia_goals where id=$1',[ids[0]])).rows[0].closure_reason,'Já não pretendo continuar');
      await action('create',null,{mentor_id:mentor,title:'Novo objetivo permitido'});
      await assert.rejects(action('plan',ids[0],{plan:'Reabrir indevidamente'}),/encerrado/);
    });
    await t.test('every exposed table has RLS and no direct mutation privilege',async()=>{
      await db.exec('reset role');
      const rows=(await db.query("select relname,relrowsecurity from pg_class where relname in ('academia_goals','academia_challenges','academia_submissions','academia_learning_audit')")).rows;
      assert.equal(rows.length,4);assert.ok(rows.every(r=>r.relrowsecurity));
      const perms=(await db.query("select has_table_privilege('authenticated','public.academia_goals','UPDATE') can_update")).rows[0];assert.equal(perms.can_update,false);
      const functions=(await db.query("select prosecdef,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='academia_learning_action'")).rows;
      assert.equal(functions[0].prosecdef,true);assert.ok(functions[0].proconfig.includes('search_path=\"\"')||functions[0].proconfig.includes('search_path='));
    });
  } finally { await db.close(); }
});
