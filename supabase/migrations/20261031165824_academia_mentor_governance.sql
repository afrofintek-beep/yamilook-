-- Mentor lifecycle. Existing commitments and reviews are retained, never auto-approved.
alter table public.mentor_profiles
 add column status text not null default 'pending' check(status in ('pending','review_required','active','rejected','suspended','inactive')),
 add column experience text not null default '';
create table public.academia_mentor_audit (
 id uuid primary key default gen_random_uuid(), mentor_id uuid not null,
 actor_id uuid, action text not null, reason text, created_at timestamptz not null default now()
);
alter table public.academia_mentor_audit enable row level security;
revoke all on public.academia_mentor_audit from public,anon,authenticated;
grant select on public.academia_mentor_audit to authenticated;
create policy "Mentor or admin reads decisions" on public.academia_mentor_audit for select to authenticated
 using (mentor_id=(select auth.uid()) or public.has_role((select auth.uid()),'admin'));
create index academia_mentor_audit_subject on public.academia_mentor_audit(mentor_id,created_at desc);
insert into public.academia_mentor_audit(mentor_id,action,reason)
 select user_id,'migration_review',case when is_verified_mentor then 'Selo anterior registado; aprovação por rever.' else 'Perfil existente enviado para revisão.' end from public.mentor_profiles;
update public.mentor_profiles set status='review_required',is_verified_mentor=false;
-- Only narrowly scoped RPCs may mutate a mentor, including for administrators.
revoke insert,update,delete on public.mentor_profiles from public,anon,authenticated;
drop trigger if exists trg_ensure_mentor_profile on public.academia_sessions;
revoke all on function public.ensure_mentor_profile() from public,anon,authenticated;

create function private.academia_save_mentor(p_specialty text,p_bio text,p_experience text,p_submit boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); m public.mentor_profiles%rowtype;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 -- Serialize first-time applications as well as updates.
 perform 1 from public.profiles where id=u for update;
 select * into m from public.mentor_profiles where user_id=u for update;
 if length(btrim(coalesce(p_specialty,''))) not between 2 and 120
 or length(btrim(coalesce(p_bio,''))) not between 10 and 2000
 or length(btrim(coalesce(p_experience,''))) not between 10 and 2000 then
  raise exception 'Preencha especialidade, biografia e experiência (10 a 2000 caracteres nos textos).'; end if;
 if m.user_id is null then
  insert into public.mentor_profiles(user_id,specialty,mentor_bio,experience)
  values(u,btrim(p_specialty),btrim(p_bio),btrim(p_experience));
 elsif p_submit and m.status in ('rejected','inactive') then
  update public.mentor_profiles set specialty=btrim(p_specialty),mentor_bio=btrim(p_bio),experience=btrim(p_experience),
   status='pending',is_verified_mentor=false,updated_at=now() where user_id=u;
 else
  -- Editing cannot clear a suspension or change approval/verification.
  update public.mentor_profiles set specialty=btrim(p_specialty),mentor_bio=btrim(p_bio),experience=btrim(p_experience),updated_at=now() where user_id=u;
 end if;
 insert into public.academia_mentor_audit(mentor_id,actor_id,action) values(u,u,case when m.user_id is null or (p_submit and m.status in ('rejected','inactive')) then 'apply' else 'edit' end);
 return jsonb_build_object('ok',true);
end $$;
create function public.academia_save_mentor(p_specialty text,p_bio text,p_experience text,p_submit boolean default false)
returns jsonb language sql security invoker set search_path='' as $$ select private.academia_save_mentor(p_specialty,p_bio,p_experience,p_submit) $$;

create function private.academia_manage_mentor(p_user uuid,p_action text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); m public.mentor_profiles%rowtype; next_status text;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not public.has_role(u,'admin') and not (u=p_user and p_action='request_deactivation') then
  raise exception 'Apenas administradores.' using errcode='42501'; end if;
 select * into m from public.mentor_profiles where user_id=p_user for update;
 if not found then raise exception 'Mentor não encontrado.'; end if;
 if length(btrim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Indique um motivo (3 a 1000 caracteres).'; end if;
 if p_action='request_deactivation' then
  insert into public.academia_mentor_audit(mentor_id,actor_id,action,reason) values(p_user,u,p_action,btrim(p_reason));
  return jsonb_build_object('ok',true);
 elsif p_action in ('approve','reactivate') then
  if (p_action='approve' and m.status not in ('pending','review_required')) or
     (p_action='reactivate' and m.status not in ('suspended','inactive')) then raise exception 'Transição inválida.'; end if;
  if length(btrim(m.specialty))<2 or length(btrim(coalesce(m.mentor_bio,'')))<10 or length(btrim(m.experience))<10 then
   raise exception 'O mentor deve completar a especialidade, biografia e experiência.'; end if;
  next_status:='active';
 elsif p_action='reject' and m.status in ('pending','review_required') then next_status:='rejected';
 elsif p_action='suspend' and m.status in ('active','review_required') then next_status:='suspended';
 elsif p_action='deactivate' then
  -- Never discard or silently strand appointments, escrow, learning plans or cohorts.
  if exists(select 1 from public.academia_sessions s where s.mentor_id=p_user and s.deleted_at is null
      and (s.status in ('scheduled','live') or exists(select 1 from public.academia_reservations r where r.session_id=s.id and r.status='reserved')))
   or exists(select 1 from public.academia_goals where mentor_id=p_user and status in ('requested','active'))
   or exists(select 1 from public.academia_cohorts where mentor_id=p_user and status='open') then
   raise exception 'Conclua ou cancele os compromissos pendentes antes de desactivar.'; end if;
  next_status:='inactive';
 elsif p_action='delete' then
  if m.status not in ('pending','rejected','inactive') then raise exception 'Desactive o perfil antes de o apagar.'; end if;
  if exists(select 1 from public.academia_sessions where mentor_id=p_user)
   or exists(select 1 from public.academia_reviews where mentor_id=p_user)
   or exists(select 1 from public.academia_goals where mentor_id=p_user)
   or exists(select 1 from public.academia_cohorts where mentor_id=p_user)
   or exists(select 1 from public.kumbu_ledger where user_id=p_user and source='academia_income') then
   raise exception 'Este mentor tem histórico. Utilize a desactivação.'; end if;
  delete from public.mentor_profiles where user_id=p_user;
 elsif p_action in ('verify','unverify') then
  if m.status<>'active' then raise exception 'Apenas mentores activos podem ser verificados.'; end if;
  update public.mentor_profiles set is_verified_mentor=(p_action='verify'),updated_at=now() where user_id=p_user;
 else raise exception 'Transição inválida.';
 end if;
 if next_status is not null then
  update public.mentor_profiles set status=next_status,is_verified_mentor=false,updated_at=now() where user_id=p_user;
 end if;
 insert into public.academia_mentor_audit(mentor_id,actor_id,action,reason) values(p_user,u,p_action,btrim(p_reason));
 return jsonb_build_object('ok',true);
end $$;
create function public.academia_manage_mentor(p_user uuid,p_action text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$ select private.academia_manage_mentor(p_user,p_action,p_reason) $$;
-- Compatibility entry point still enforces the lifecycle and records the action.
create or replace function public.admin_set_mentor_verified(p_user uuid,p_verified boolean)
returns jsonb language sql security invoker set search_path='' as $$
 select private.academia_manage_mentor(p_user,case when p_verified then 'verify' else 'unverify' end,'Verificação administrativa') $$;

create function private.academia_admin_mentors()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.has_role(auth.uid(),'admin') then raise exception 'Apenas administradores.' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (select m.*,p.display_name,p.username,
  (select count(*) from public.academia_sessions s where s.mentor_id=m.user_id and s.deleted_at is null and s.status in ('scheduled','live')) as pending_sessions,
  (select a.action from public.academia_mentor_audit a where a.mentor_id=m.user_id and a.action<>'edit' order by a.created_at desc,a.id desc limit 1) as latest_action
  from public.mentor_profiles m join public.profiles p on p.id=m.user_id order by m.updated_at desc) t),'[]'::jsonb);
end $$;
create function public.academia_admin_mentors() returns jsonb language sql security invoker set search_path='' as $$ select private.academia_admin_mentors() $$;

-- Guards also apply to privileged legacy RPCs, not just the browser insert.
create function private.academia_guard_mentor_session() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.mentor_profiles%rowtype; publishing boolean;
begin
 select * into m from public.mentor_profiles where user_id=new.mentor_id for share;
 publishing:=tg_op='INSERT';
 if tg_op='UPDATE' then publishing:=new.mentor_id is distinct from old.mentor_id or new.scheduled_at is distinct from old.scheduled_at or new.price_coins is distinct from old.price_coins; end if;
 if publishing then
  if m.status is distinct from 'active' then raise exception 'Aprovação de mentor necessária.' using errcode='42501'; end if;
  if coalesce(new.price_coins,0)>0 and not m.is_verified_mentor then raise exception 'Verificação de mentor necessária para cobrar.' using errcode='42501'; end if;
 elsif new.status='live' and old.status<>'live' and (m.status is null or m.status not in ('active','review_required')) then
  raise exception 'Mentor indisponível. Contacte o suporte.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger academia_guard_mentor_session before insert or update on public.academia_sessions for each row execute function private.academia_guard_mentor_session();
create function private.academia_guard_mentor_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare m public.mentor_profiles%rowtype; s public.academia_sessions%rowtype;
begin
 if tg_op='UPDATE' then if new.status<>'reserved' or old.status='reserved' then return new; end if; end if;
 select * into s from public.academia_sessions where id=new.session_id;
 select * into m from public.mentor_profiles where user_id=s.mentor_id for share;
 if m.status is null or m.status not in ('active','review_required') then raise exception 'Mentor indisponível.'; end if;
 if coalesce(s.price_coins,0)>0 and (m.status<>'active' or not m.is_verified_mentor) then raise exception 'Verificação de mentor necessária para novas reservas pagas.'; end if;
 return new;
end $$;
create trigger academia_guard_mentor_reservation before insert or update on public.academia_reservations for each row execute function private.academia_guard_mentor_reservation();
create function private.academia_guard_new_mentorship() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.mentor_id is not null and not exists(select 1 from public.mentor_profiles where user_id=new.mentor_id and status='active') then
  raise exception 'Escolha um mentor aprovado.' using errcode='42501'; end if;
 return new;
end $$;
create trigger academia_guard_new_cohort before insert on public.academia_cohorts for each row execute function private.academia_guard_new_mentorship();
create trigger academia_guard_new_goal before insert or update of mentor_id on public.academia_goals for each row execute function private.academia_guard_new_mentorship();

-- Attendance is independent of billing completion (which marks all reservations attended).
create table public.academia_attendance (
 session_id uuid not null references public.academia_sessions(id), user_id uuid not null,
 confirmed_by uuid not null, confirmed_at timestamptz not null default now(), primary key(session_id,user_id)
);
alter table public.academia_attendance enable row level security;
revoke all on public.academia_attendance from public,anon,authenticated;
grant select on public.academia_attendance to authenticated;
create policy "Attendance visible to participant host admin" on public.academia_attendance for select to authenticated
 using(user_id=(select auth.uid()) or public.has_role((select auth.uid()),'admin') or exists(select 1 from public.academia_sessions s where s.id=session_id and s.mentor_id=(select auth.uid())));
create function private.academia_confirm_attendance(p_session uuid,p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.academia_sessions%rowtype; u uuid:=auth.uid();
begin
 select * into s from public.academia_sessions where id=p_session for update;
 if u is null or not found or (s.mentor_id<>u and not public.has_role(u,'admin')) then raise exception 'Apenas o mentor ou administrador.' using errcode='42501'; end if;
 if s.status not in ('live','ended','completed') or s.deleted_at is not null or p_user=s.mentor_id then raise exception 'Sessão ou participante inválido.'; end if;
 if not exists(select 1 from public.academia_reservations where session_id=p_session and user_id=p_user and status in ('reserved','attended')) then raise exception 'Inscrição válida necessária.'; end if;
 insert into public.academia_attendance(session_id,user_id,confirmed_by) values(p_session,p_user,u) on conflict do nothing;
 return jsonb_build_object('ok',true);
end $$;
create function public.academia_confirm_attendance(p_session uuid,p_user uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.academia_confirm_attendance(p_session,p_user) $$;

create function public.academia_can_review(p_session uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.academia_sessions s
 join public.academia_attendance a on a.session_id=s.id and a.user_id=auth.uid()
 join public.academia_reservations r on r.session_id=s.id and r.user_id=auth.uid()
 where s.id=p_session and s.mentor_id<>auth.uid() and s.status in ('ended','completed') and s.deleted_at is null and r.status in ('reserved','attended')) $$;
-- Restrictive policies cover ALL permissive policies, including production-only legacy ones.
create policy "Review requires confirmed attendance insert" on public.academia_reviews as restrictive for insert to authenticated
 with check(reviewer_id=(select auth.uid()) and public.academia_can_review(session_id) and mentor_id=(select mentor_id from public.academia_sessions where id=session_id));
create policy "Review requires confirmed attendance update" on public.academia_reviews as restrictive for update to authenticated
 using(reviewer_id=(select auth.uid()) and public.academia_can_review(session_id))
 with check(reviewer_id=(select auth.uid()) and public.academia_can_review(session_id) and mentor_id=(select mentor_id from public.academia_sessions where id=session_id));
create function private.academia_review_identity_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.session_id<>old.session_id or new.mentor_id<>old.mentor_id or new.reviewer_id<>old.reviewer_id or new.created_at<>old.created_at then
 raise exception 'A identidade da avaliação não pode ser alterada.'; end if;
 return new;
end $$;
create trigger academia_review_identity_guard before update on public.academia_reviews for each row execute function private.academia_review_identity_guard();
create function public.academia_mentor_stats(p_ids uuid[]) returns table(mentor_id uuid,rating numeric,review_count bigint)
language sql stable security invoker set search_path='' as $$
 select r.mentor_id,avg(r.rating)::numeric,count(*) from public.academia_reviews r where r.mentor_id=any(p_ids) group by r.mentor_id $$;

-- Private definer bodies authorize every request. Exposed wrappers are invokers.
grant usage on schema private to authenticated;
revoke all on function private.academia_save_mentor(text,text,text,boolean),private.academia_manage_mentor(uuid,text,text),private.academia_admin_mentors(),private.academia_confirm_attendance(uuid,uuid) from public,anon,authenticated;
grant execute on function private.academia_save_mentor(text,text,text,boolean),private.academia_manage_mentor(uuid,text,text),private.academia_admin_mentors(),private.academia_confirm_attendance(uuid,uuid) to authenticated;
revoke all on function private.academia_guard_mentor_session(),private.academia_guard_mentor_reservation(),private.academia_guard_new_mentorship(),private.academia_review_identity_guard() from public,anon,authenticated;
revoke all on function public.academia_save_mentor(text,text,text,boolean),public.academia_manage_mentor(uuid,text,text),public.academia_admin_mentors(),public.academia_confirm_attendance(uuid,uuid),public.academia_can_review(uuid),public.academia_mentor_stats(uuid[]),public.admin_set_mentor_verified(uuid,boolean),public.admin_list_mentors() from public,anon;
grant execute on function public.academia_save_mentor(text,text,text,boolean),public.academia_manage_mentor(uuid,text,text),public.academia_admin_mentors(),public.academia_confirm_attendance(uuid,uuid),public.academia_can_review(uuid),public.academia_mentor_stats(uuid[]),public.admin_set_mentor_verified(uuid,boolean) to authenticated;
notify pgrst,'reload schema';
