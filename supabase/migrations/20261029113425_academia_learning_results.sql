-- Private, goal-based mentoring. Writes are serialized and authorized by the API;
-- browser roles can only read rows shared with them, never self-approve work.
create table public.academia_goals (
 id uuid primary key default gen_random_uuid(),
 learner_id uuid not null references public.profiles(id),
 mentor_id uuid not null references public.profiles(id),
 title text not null check(length(btrim(title)) between 6 and 160),
 context text not null default '' check(length(context)<=2000),
 plan text not null default '' check(length(plan)<=4000),
 closure_reason text not null default '' check(length(closure_reason)<=1000),
 status text not null default 'requested' check(status in ('requested','active','completed','cancelled')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(learner_id<>mentor_id)
);
create index academia_goals_learner on public.academia_goals(learner_id,created_at desc);
create index academia_goals_mentor on public.academia_goals(mentor_id,created_at desc);
create table public.academia_challenges (
 id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.academia_goals(id),
 position smallint not null check(position between 1 and 20), unique(goal_id,position),
 title text not null check(length(btrim(title)) between 3 and 160),
 instructions text not null check(length(btrim(instructions)) between 3 and 3000),
 skill text not null check(length(btrim(skill)) between 3 and 100),
 status text not null default 'open' check(status in ('open','submitted','revision','approved')),
 created_at timestamptz not null default now()
);
create index academia_challenges_goal on public.academia_challenges(goal_id,created_at);
create table public.academia_submissions (
 id uuid primary key default gen_random_uuid(), challenge_id uuid not null references public.academia_challenges(id),
 content text not null check(length(btrim(content)) between 3 and 4000),
 evidence_url text check(evidence_url is null or (length(evidence_url)<=2000 and evidence_url ~ '^https://[^[:space:]]+$')),
 status text not null default 'pending' check(status in ('pending','revision','approved')),
 feedback text not null default '' check(length(feedback)<=3000),
 created_at timestamptz not null default now(), reviewed_at timestamptz
);
create index academia_submissions_challenge on public.academia_submissions(challenge_id,created_at desc);
create table public.academia_learning_audit (
 id uuid primary key default gen_random_uuid(), goal_id uuid not null references public.academia_goals(id),
 actor_id uuid not null, action text not null, entity_id uuid not null,
 created_at timestamptz not null default now()
);
create index academia_learning_audit_goal on public.academia_learning_audit(goal_id,created_at);
alter table public.academia_goals enable row level security;
alter table public.academia_challenges enable row level security;
alter table public.academia_submissions enable row level security;
alter table public.academia_learning_audit enable row level security;
revoke all on public.academia_goals,public.academia_challenges,public.academia_submissions,public.academia_learning_audit from anon,authenticated;
grant select on public.academia_goals,public.academia_challenges,public.academia_submissions,public.academia_learning_audit to authenticated;
create policy "Goal participants read" on public.academia_goals for select to authenticated
 using(learner_id=(select auth.uid()) or mentor_id=(select auth.uid()));
create policy "Goal participants read challenges" on public.academia_challenges for select to authenticated
 using(exists(select 1 from public.academia_goals g where g.id=goal_id));
create policy "Goal participants read submissions" on public.academia_submissions for select to authenticated
 using(exists(select 1 from public.academia_challenges c where c.id=challenge_id));
create policy "Goal participants read audit" on public.academia_learning_audit for select to authenticated
 using(exists(select 1 from public.academia_goals g where g.id=goal_id));

create schema if not exists private;
-- Elevation is required to keep all direct writes revoked. Authorization is
-- checked explicitly for each action; no caller can choose the actor or learner.
create function private.academia_learning_action(p_action text,p_goal uuid default null,p_payload jsonb default '{}')
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
  perform 1 from public.profiles where id=u for update;
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
revoke all on function private.academia_learning_action(text,uuid,jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.academia_learning_action(text,uuid,jsonb) to authenticated;
create function public.academia_learning_action(p_action text,p_goal uuid default null,p_payload jsonb default '{}')
returns uuid language sql security invoker set search_path='' as $$
 select private.academia_learning_action(p_action,p_goal,p_payload);
$$;
revoke all on function public.academia_learning_action(text,uuid,jsonb) from public,anon;
grant execute on function public.academia_learning_action(text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';

-- Aggregate under the caller's RLS without transferring every challenge to lists.
create function public.academia_learning_progress(p_goals uuid[])
returns table(goal_id uuid,total bigint,approved bigint)
language sql stable security invoker set search_path='' as $$
 select c.goal_id,count(*),count(*) filter(where c.status='approved')
 from public.academia_challenges c where c.goal_id=any(p_goals) group by c.goal_id;
$$;
revoke all on function public.academia_learning_progress(uuid[]) from public,anon;
grant execute on function public.academia_learning_progress(uuid[]) to authenticated;
