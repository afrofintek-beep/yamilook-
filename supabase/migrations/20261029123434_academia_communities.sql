create table public.academia_communities (
 slug text primary key, title text not null, description text not null, position smallint not null,
 starter_title text not null, starter_instructions text not null, starter_skill text not null
);
insert into public.academia_communities values
 ('beleza-moda','Beleza, moda e imagem','Barbearia, cabelo, tranças, maquilhagem, costura e apresentação de serviços.',1,'Apresentar o meu serviço','Prepara uma apresentação do teu serviço e explica como calculaste o preço.','Apresentação de serviços'),
 ('cozinha-negocios','Cozinha e negócios alimentares','Cozinha, pastelaria, catering e pequenos negócios alimentares.',2,'Preparar uma oferta com preço','Apresenta um produto, os ingredientes, os custos e o preço proposto.','Formação de preços'),
 ('criacao-digital','Criação digital e comunicação','Fotografia, vídeo, design, redes sociais e ferramentas digitais.',3,'Criar uma apresentação digital','Cria uma fotografia, cartaz ou vídeo curto para apresentar um negócio.','Comunicação digital'),
 ('musica-expressao','Música, dança e expressão','Música, produção, DJ, dança, apresentação e expressão artística.',4,'Mostrar uma criação minha','Apresenta uma criação ou interpretação e explica o que queres melhorar.','Expressão criativa'),
 ('oficios-solucoes','Ofícios e soluções práticas','Reparação, carpintaria, mecânica, energia e outros ofícios com prática acompanhada.',5,'Apresentar um diagnóstico e orçamento','Com o acompanhamento do mentor, descreve um problema e prepara uma proposta de serviço adequada ao teu nível.','Diagnóstico e orçamento'),
 ('emprego-carreira','Emprego e crescimento profissional','Preparação para emprego, línguas, contabilidade, logística e desenvolvimento profissional.',6,'Preparar uma candidatura','Adapta um CV e uma apresentação a uma oportunidade concreta.','Preparação profissional');
create table public.academia_cohorts (
 id uuid primary key default gen_random_uuid(), community_slug text not null references public.academia_communities(slug),
 mentor_id uuid not null references public.profiles(id), mentor_name text not null,
 title text not null check(length(btrim(title)) between 6 and 160),
 level text not null default 'beginner' check(level in ('beginner','practice','advanced')),
 language text not null default 'Português' check(length(btrim(language)) between 2 and 60),
 locality text not null default 'Online' check(length(btrim(locality)) between 2 and 100),
 requirements text not null default '' check(length(requirements)<=1000),
 plan text not null check(length(btrim(plan)) between 10 and 4000),
 challenge_title text not null check(length(btrim(challenge_title)) between 3 and 160),
 instructions text not null check(length(btrim(instructions)) between 3 and 3000),
 skill text not null check(length(btrim(skill)) between 3 and 100),
 capacity smallint not null check(capacity between 1 and 20), seats_taken smallint not null default 0 check(seats_taken>=0 and seats_taken<=capacity),
 status text not null default 'open' check(status in ('open','closed')), created_at timestamptz not null default now()
);
create index academia_cohorts_community on public.academia_cohorts(community_slug,status,created_at desc);
create index academia_cohorts_mentor on public.academia_cohorts(mentor_id);
-- This table contains only the explicitly public snapshot, never private work,
-- account IDs, submissions, feedback or the learner/mentor conversation.
create table public.academia_public_works (
 id uuid primary key default gen_random_uuid(), community_slug text not null references public.academia_communities(slug),
 cohort_id uuid references public.academia_cohorts(id), title text not null, skill text not null,
 caption text not null check(length(btrim(caption)) between 3 and 1000), learner_name text not null, mentor_name text not null,
 evidence_url text check(evidence_url is null or (length(evidence_url)<=2000 and evidence_url ~ '^https://[^[:space:]]+$')),
 published boolean not null default true, created_at timestamptz not null default now()
);
create index academia_public_works_community on public.academia_public_works(community_slug,published,created_at desc);
create index academia_public_works_cohort on public.academia_public_works(cohort_id);
create table public.academia_work_sources (
 work_id uuid primary key references public.academia_public_works(id), challenge_id uuid not null unique references public.academia_challenges(id),
 owner_id uuid not null references public.profiles(id)
);
create index academia_work_sources_owner on public.academia_work_sources(owner_id);
create table public.academia_cohort_members (
 id uuid primary key default gen_random_uuid(), cohort_id uuid not null references public.academia_cohorts(id),
 learner_id uuid not null references public.profiles(id), goal_id uuid not null unique references public.academia_goals(id),
 source_work_id uuid references public.academia_public_works(id), created_at timestamptz not null default now(), unique(cohort_id,learner_id)
);
create index academia_cohort_members_learner on public.academia_cohort_members(learner_id);
create index academia_cohort_members_source on public.academia_cohort_members(source_work_id);
create table public.academia_community_audit (
 id uuid primary key default gen_random_uuid(), actor_id uuid not null, action text not null,
 cohort_id uuid references public.academia_cohorts(id), work_id uuid references public.academia_public_works(id), created_at timestamptz not null default now()
);
create index academia_community_audit_actor on public.academia_community_audit(actor_id,created_at desc);
create index academia_community_audit_cohort on public.academia_community_audit(cohort_id);
create index academia_community_audit_work on public.academia_community_audit(work_id);
alter table public.academia_communities enable row level security;
alter table public.academia_cohorts enable row level security;
alter table public.academia_public_works enable row level security;
alter table public.academia_work_sources enable row level security;
alter table public.academia_cohort_members enable row level security;
alter table public.academia_community_audit enable row level security;
revoke all on public.academia_communities,public.academia_cohorts,public.academia_public_works,public.academia_work_sources,public.academia_cohort_members,public.academia_community_audit from anon,authenticated;
grant select on public.academia_communities,public.academia_cohorts,public.academia_public_works to anon,authenticated;
grant select on public.academia_work_sources,public.academia_cohort_members,public.academia_community_audit to authenticated;
create policy "Discover communities" on public.academia_communities for select to anon,authenticated using(true);
create policy "Discover cohorts" on public.academia_cohorts for select to anon,authenticated using(true);
create policy "Owner reads private work source" on public.academia_work_sources for select to authenticated using(owner_id=(select auth.uid()));
create policy "Public reads voluntarily published work" on public.academia_public_works for select to anon using(published);
create policy "Public or own work" on public.academia_public_works for select to authenticated
 using(published or exists(select 1 from public.academia_work_sources s where s.work_id=id and s.owner_id=(select auth.uid())));
create policy "Mentor or learner reads enrollment" on public.academia_cohort_members for select to authenticated
 using(learner_id=(select auth.uid()) or exists(select 1 from public.academia_cohorts c where c.id=cohort_id and c.mentor_id=(select auth.uid())));
create policy "Own or mentor audit" on public.academia_community_audit for select to authenticated
 using(actor_id=(select auth.uid()) or exists(select 1 from public.academia_cohorts c where c.id=cohort_id and c.mentor_id=(select auth.uid())));

create function private.academia_community_action(p_action text,p_target uuid default null,p_payload jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); c public.academia_cohorts%rowtype; g public.academia_goals%rowtype;
 t public.academia_challenges%rowtype; s public.academia_submissions%rowtype; w public.academia_public_works%rowtype;
 result uuid; goal uuid; source uuid; cohort uuid; own_name text; mentor_name text; category text;
begin
 if u is null then raise exception 'Inicia sessão novamente.' using errcode='42501'; end if;
 if p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Pedido inválido.'; end if;
 if p_action='cohort_create' then
  if not exists(select 1 from public.mentor_profiles where user_id=u) then raise exception 'Apenas um mentor pode abrir uma turma.' using errcode='42501'; end if;
  perform 1 from public.profiles where id=u for no key update;
  if (select count(*) from public.academia_cohorts where mentor_id=u and status='open')>=3 then raise exception 'Já tens três turmas abertas.'; end if;
  select coalesce(nullif(display_name,''),'Mentor') into own_name from public.profiles where id=u;
  insert into public.academia_cohorts(community_slug,mentor_id,mentor_name,title,plan,challenge_title,instructions,skill,capacity,level,language,locality,requirements)
   values(p_payload->>'community_slug',u,own_name,btrim(p_payload->>'title'),btrim(p_payload->>'plan'),btrim(p_payload->>'challenge_title'),btrim(p_payload->>'instructions'),btrim(p_payload->>'skill'),coalesce((p_payload->>'capacity')::smallint,10),coalesce(p_payload->>'level','beginner'),coalesce(nullif(btrim(p_payload->>'language'),''),'Português'),coalesce(nullif(btrim(p_payload->>'locality'),''),'Online'),btrim(coalesce(p_payload->>'requirements',''))) returning * into c;
  result:=c.id;cohort:=c.id;
 elsif p_action in ('cohort_join','cohort_close') then
  select * into c from public.academia_cohorts where id=p_target for update;
  if not found then raise exception 'Turma não encontrada.'; end if;
  cohort:=c.id;
  if p_action='cohort_close' then
   if c.mentor_id<>u then raise exception 'Apenas o mentor pode fechar as inscrições.' using errcode='42501'; end if;
   update public.academia_cohorts set status='closed' where id=c.id; result:=c.id;
  else
   select goal_id into result from public.academia_cohort_members where cohort_id=c.id and learner_id=u;
   if found then return result; end if; -- Safe retry never consumes another seat.
   if c.mentor_id=u then raise exception 'O mentor não pode ocupar uma vaga da própria turma.'; end if;
   if c.status<>'open' or c.seats_taken>=c.capacity then raise exception 'As inscrições desta turma estão encerradas ou esgotadas.'; end if;
   perform 1 from public.profiles where id=u for no key update;
   if (select count(*) from public.academia_goals where learner_id=u and status in ('requested','active'))>=5 then raise exception 'Já tens cinco percursos em curso.'; end if;
   select id into source from public.academia_public_works where id=nullif(p_payload->>'source_work_id','')::uuid
    and published and community_slug=c.community_slug and (cohort_id is null or cohort_id=c.id);
   insert into public.academia_goals(learner_id,mentor_id,title,context,plan,status)
    values(u,c.mentor_id,c.title,'Turma de desafios: '||c.title,c.plan,'active') returning id into goal;
   insert into public.academia_challenges(goal_id,position,title,instructions,skill) values(goal,1,c.challenge_title,c.instructions,c.skill);
   insert into public.academia_cohort_members(cohort_id,learner_id,goal_id,source_work_id) values(c.id,u,goal,source);
   update public.academia_cohorts set seats_taken=seats_taken+1 where id=c.id;
   insert into public.academia_learning_audit(goal_id,actor_id,action,entity_id) values(goal,u,'cohort_join',c.id);
   result:=goal;
  end if;
 elsif p_action='work_publish' then
  if coalesce((p_payload->>'consent')::boolean,false) is not true then raise exception 'Confirma o que queres tornar público.'; end if;
  -- Follow the same goal -> challenge lock order as private reviews/completion.
  select g0.* into g from public.academia_goals g0 join public.academia_challenges t0 on t0.goal_id=g0.id where t0.id=p_target for update of g0;
  if not found or g.learner_id<>u then raise exception 'Apenas o aluno pode publicar o próprio trabalho.' using errcode='42501'; end if;
  select * into t from public.academia_challenges where id=p_target for update;
  if t.status<>'approved' then raise exception 'O mentor tem de validar o trabalho antes da publicação.'; end if;
  select * into s from public.academia_submissions where challenge_id=t.id and status='approved' order by reviewed_at desc limit 1;
  if not found then raise exception 'Não existe uma entrega validada.'; end if;
  select c0.* into c from public.academia_cohorts c0 join public.academia_cohort_members m on m.cohort_id=c0.id where m.goal_id=g.id;
  cohort:=c.id;category:=coalesce(c.community_slug,p_payload->>'community_slug');
  select coalesce(nullif(display_name,''),'Participante') into own_name from public.profiles where id=u;
  select coalesce(nullif(display_name,''),'Mentor') into mentor_name from public.profiles where id=g.mentor_id;
  select work_id into result from public.academia_work_sources where challenge_id=t.id;
  if result is null then
   insert into public.academia_public_works(community_slug,cohort_id,title,skill,caption,learner_name,mentor_name,evidence_url)
    values(category,cohort,t.title,t.skill,btrim(p_payload->>'caption'),own_name,mentor_name,
     case when coalesce((p_payload->>'include_evidence')::boolean,false) then s.evidence_url else null end) returning id into result;
   insert into public.academia_work_sources(work_id,challenge_id,owner_id) values(result,t.id,u);
  else
   update public.academia_public_works set caption=btrim(p_payload->>'caption'),published=true,
    evidence_url=case when coalesce((p_payload->>'include_evidence')::boolean,false) then s.evidence_url else null end where id=result;
  end if;
 elsif p_action='work_hide' then
  select w0.* into w from public.academia_public_works w0 join public.academia_work_sources s0 on s0.work_id=w0.id where w0.id=p_target and s0.owner_id=u for update of w0;
  if not found then raise exception 'Não tens acesso a esta publicação.' using errcode='42501'; end if;
  update public.academia_public_works set published=false where id=w.id;
  result:=w.id;cohort:=w.cohort_id;
 else raise exception 'Ação inválida.';
 end if;
 insert into public.academia_community_audit(actor_id,action,cohort_id,work_id)
  values(u,p_action,cohort,case when p_action in ('work_publish','work_hide') then result else null end);
 return result;
end $$;
revoke all on function private.academia_community_action(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.academia_community_action(text,uuid,jsonb) to authenticated;
create function public.academia_community_action(p_action text,p_target uuid default null,p_payload jsonb default '{}')
returns uuid language sql security invoker set search_path='' as $$ select private.academia_community_action(p_action,p_target,p_payload); $$;
revoke all on function public.academia_community_action(text,uuid,jsonb) from public,anon;
grant execute on function public.academia_community_action(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';

-- A non-key lock serializes limits while allowing foreign-key references from
-- other learners/mentors; cross-enrollment must not deadlock on profile FKs.
create or replace function private.academia_learning_action(p_action text,p_goal uuid default null,p_payload jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); g public.academia_goals%rowtype; c public.academia_challenges%rowtype;
 s public.academia_submissions%rowtype; result uuid; requested_mentor uuid; txt text;
begin
 if u is null then raise exception 'Inicia sessão novamente.' using errcode='42501'; end if;
 if p_action is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception 'Pedido inválido.'; end if;
 if p_action='create' then
  requested_mentor:=(p_payload->>'mentor_id')::uuid;
  if requested_mentor is null or requested_mentor=u or not exists(select 1 from public.mentor_profiles where user_id=requested_mentor) then
   raise exception 'Escolhe um mentor válido.'; end if;
  -- Serialize the per-learner limit, even for concurrent requests.
  perform 1 from public.profiles where id=u for no key update;
  if (select count(*) from public.academia_goals where learner_id=u and status in ('requested','active'))>=5 then
   raise exception 'Já tens cinco percursos em curso.'; end if;
  insert into public.academia_goals(learner_id,mentor_id,title,context)
   values(u,requested_mentor,btrim(p_payload->>'title'),btrim(coalesce(p_payload->>'context',''))) returning * into g;
  result:=g.id;
 else
  select * into g from public.academia_goals where id=p_goal for update;
  if not found or (u<>g.learner_id and u<>g.mentor_id) then
   raise exception 'Não tens acesso a este percurso.' using errcode='42501'; end if;
  if g.status in ('completed','cancelled') then raise exception 'Este percurso está encerrado.'; end if;
  result:=g.id;
  if p_action='cancel' then
   if length(btrim(coalesce(p_payload->>'reason','')))<3 or length(p_payload->>'reason')>1000 then
    raise exception 'Indica o motivo do encerramento.'; end if;
   update public.academia_goals set status='cancelled',closure_reason=btrim(p_payload->>'reason') where id=g.id;
  elsif p_action='plan' then
   if u<>g.mentor_id then raise exception 'Apenas o mentor pode definir o plano.' using errcode='42501'; end if;
   txt:=btrim(p_payload->>'plan');
   if txt is null or length(txt) not between 10 and 4000 then raise exception 'Escreve um plano com 10 a 4000 caracteres.'; end if;
   update public.academia_goals set plan=txt,status='active' where id=g.id;
   -- Starter template is optional and only available on initial acceptance.
   if g.status='requested' and p_payload->>'template'='first_sale' then
    insert into public.academia_challenges(goal_id,position,title,instructions,skill) values
     (g.id,1,'Definir a oferta','Descreve o produto ou serviço, o cliente e o problema que resolves.','Definição de oferta'),
     (g.id,2,'Calcular custos e preço','Apresenta os custos e justifica o preço de venda.','Formação de preços'),
     (g.id,3,'Preparar a apresentação comercial','Entrega uma apresentação ou catálogo para receber feedback antes de divulgar.','Apresentação comercial');
   end if;
  elsif p_action='challenge' then
   if u<>g.mentor_id then raise exception 'Apenas o mentor pode criar desafios.' using errcode='42501'; end if;
   if g.status<>'active' then raise exception 'Aceita o percurso e define primeiro o plano.'; end if;
   if (select count(*) from public.academia_challenges where goal_id=g.id)>=20 then raise exception 'Limite de vinte desafios atingido.'; end if;
   insert into public.academia_challenges(goal_id,position,title,instructions,skill)
    values(g.id,(select count(*)+1 from public.academia_challenges where goal_id=g.id),btrim(p_payload->>'title'),btrim(p_payload->>'instructions'),btrim(p_payload->>'skill')) returning id into result;
  elsif p_action='submit' or p_action='review' then
   if g.status<>'active' then raise exception 'O percurso ainda não está ativo.'; end if;
   select * into c from public.academia_challenges where id=(p_payload->>'challenge_id')::uuid and goal_id=g.id for update;
   if not found then raise exception 'Desafio não encontrado.'; end if;
   if p_action='submit' then
    if u<>g.learner_id then raise exception 'Apenas o aluno pode entregar o trabalho.' using errcode='42501'; end if;
    if c.status not in ('open','revision') then raise exception 'Aguarda a avaliação do mentor.'; end if;
    if (select count(*) from public.academia_submissions where challenge_id=c.id)>=20 then raise exception 'Limite de entregas atingido.'; end if;
    insert into public.academia_submissions(challenge_id,content,evidence_url)
     values(c.id,btrim(p_payload->>'content'),nullif(btrim(p_payload->>'evidence_url'),'')) returning id into result;
    update public.academia_challenges set status='submitted' where id=c.id;
   else
    if u<>g.mentor_id then raise exception 'Apenas o mentor pode avaliar.' using errcode='42501'; end if;
    select * into s from public.academia_submissions where id=(p_payload->>'submission_id')::uuid and challenge_id=c.id for update;
    if not found or s.status<>'pending' or c.status<>'submitted' then raise exception 'Esta entrega já foi avaliada ou não está pendente.'; end if;
    if coalesce(p_payload->>'decision','') not in ('approved','revision') then raise exception 'Avaliação inválida.'; end if;
    txt:=btrim(p_payload->>'feedback');
    if txt is null or length(txt) not between 3 and 3000 then raise exception 'Escreve feedback com 3 a 3000 caracteres.'; end if;
    update public.academia_submissions set status=p_payload->>'decision',feedback=txt,reviewed_at=now() where id=s.id;
    update public.academia_challenges set status=p_payload->>'decision' where id=c.id;
    result:=s.id;
   end if;
  elsif p_action='complete' then
   if u<>g.mentor_id then raise exception 'Apenas o mentor pode concluir o percurso.' using errcode='42501'; end if;
   if not exists(select 1 from public.academia_challenges where goal_id=g.id)
     or exists(select 1 from public.academia_challenges where goal_id=g.id and status<>'approved') then
    raise exception 'Valida todos os desafios antes de concluir o percurso.'; end if;
   update public.academia_goals set status='completed' where id=g.id;
  else raise exception 'Ação inválida.';
  end if;
 end if;
 update public.academia_goals set updated_at=now() where id=g.id;
 insert into public.academia_learning_audit(goal_id,actor_id,action,entity_id) values(g.id,u,p_action,result);
 return result;
end $$;
