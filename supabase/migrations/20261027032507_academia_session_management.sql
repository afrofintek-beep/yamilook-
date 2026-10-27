-- Lifecycle actions are atomic, authorized, audited, and serialized with billing.
alter table public.academia_sessions
 add column archived_at timestamptz,
 add column deleted_at timestamptz,
 add column cancellation_reason text;

create table public.academia_session_actions (
 id uuid primary key default gen_random_uuid(), session_id uuid not null,
 actor_id uuid not null, action text not null, reason text, created_at timestamptz not null default now()
);
alter table public.academia_session_actions enable row level security;
revoke all on public.academia_session_actions from anon, authenticated;
grant select on public.academia_session_actions to authenticated;
create policy "Admins read session audit" on public.academia_session_actions for select to authenticated
 using (public.has_role((select auth.uid()), 'admin'));

create table public.academia_session_notices (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.academia_sessions(id),
 user_id uuid not null, title text not null, reason text not null, refunded integer not null default 0,
 created_at timestamptz not null default now(), unique(session_id,user_id)
);
alter table public.academia_session_notices enable row level security;
revoke all on public.academia_session_notices from anon, authenticated;
grant select on public.academia_session_notices to authenticated;
create policy "Participants read own cancellation notices" on public.academia_session_notices
 for select to authenticated using (user_id=(select auth.uid()));
create index academia_session_notices_user on public.academia_session_notices(user_id,created_at desc);

-- A restrictive policy cannot be bypassed by existing permissive read policies.
create policy "Hide deleted sessions" on public.academia_sessions as restrictive for select
 using (deleted_at is null);

create schema if not exists private;
create function private.academia_guard_lifecycle() returns trigger language plpgsql
set search_path='' as $$
begin
 if current_user in ('anon','authenticated') then
  if tg_op='INSERT' then
   if new.archived_at is not null or new.deleted_at is not null or new.cancellation_reason is not null
      or new.status <> 'scheduled' then raise exception 'Use session management'; end if;
  elsif new.archived_at is distinct from old.archived_at or new.deleted_at is distinct from old.deleted_at
     or new.cancellation_reason is distinct from old.cancellation_reason
     or new.mentor_id is distinct from old.mentor_id
     or (new.status is distinct from old.status and (new.status not in ('live','ended') or old.status in ('ended','completed','cancelled'))) then
    raise exception 'Use session management';
  end if;
 end if;
 if tg_op='UPDATE' and (old.archived_at is not null or old.deleted_at is not null or old.status='cancelled')
    and new.status is distinct from old.status then raise exception 'Session closed'; end if;
 return new;
end $$;
revoke all on function private.academia_guard_lifecycle() from public,anon,authenticated;
create trigger academia_guard_lifecycle before insert or update on public.academia_sessions
 for each row execute function private.academia_guard_lifecycle();

create function private.academia_manage_session(p_session uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.academia_sessions%rowtype; u uuid:=auth.uid(); r record; refund int; bal int;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into s from public.academia_sessions where id=p_session for update;
 if not found or s.deleted_at is not null then raise exception 'Session not found'; end if;
 if s.mentor_id<>u and not public.has_role(u,'admin') then raise exception 'Not allowed' using errcode='42501'; end if;
 if p_action='archive' then
  if s.status='live' or (s.status not in ('ended','completed','cancelled') and s.scheduled_at>now()) then
   raise exception 'Only past or closed sessions can be archived'; end if;
  if exists(select 1 from public.academia_reservations where session_id=s.id and status='reserved') then
   raise exception 'Conclua ou cancele a sessão antes de arquivar as inscrições pendentes'; end if;
  if s.archived_at is not null then return jsonb_build_object('ok',true); end if;
  update public.academia_sessions set archived_at=now() where id=s.id;
 elsif p_action='restore' then
  if s.archived_at is null then return jsonb_build_object('ok',true); end if;
  update public.academia_sessions set archived_at=null where id=s.id;
 elsif p_action='delete' then
  if s.status not in ('scheduled','draft') or exists(select 1 from public.academia_reservations where session_id=s.id)
    or exists(select 1 from public.academia_reviews where session_id=s.id)
    or exists(select 1 from public.kumbu_ledger where reference_id=s.id)
    or exists(select 1 from public.academia_session_notices where session_id=s.id) then
   raise exception 'Esta sessão tem histórico. Arquive-a.'; end if;
  -- Logical deletion keeps the audit trail; hidden from all application reads.
  update public.academia_sessions set deleted_at=now() where id=s.id;
 elsif p_action='cancel' then
  if s.status='cancelled' then return jsonb_build_object('ok',true); end if;
  if s.archived_at is not null or s.status in ('live','ended','completed')
     or exists(select 1 from public.academia_reservations where session_id=s.id and status='attended') then
   raise exception 'Esta sessão já começou ou terminou'; end if;
  if length(btrim(coalesce(p_reason,'')))<3 or length(p_reason)>1000 then raise exception 'Indique o motivo (3 a 1000 caracteres)'; end if;
  for r in select * from public.academia_reservations where session_id=s.id and status='reserved' order by user_id for update loop
   -- Lock balance before reading ledger, also serializing with learner refunds.
   select kumbu_available into bal from public.profiles where id=r.user_id for update;
   select greatest(0,-coalesce(sum(amount),0)) into refund from public.kumbu_ledger
    where user_id=r.user_id and reference_id=s.id and source='academia';
   if refund>0 then
    update public.profiles set kumbu_available=coalesce(kumbu_available,0)+refund,updated_at=now()
     where id=r.user_id returning kumbu_available into bal;
    if not found then raise exception 'Refund account missing'; end if;
    insert into public.kumbu_ledger(user_id,amount,action_type,source,reference_id,description,balance_after)
     values(r.user_id,refund,'spend','academia',s.id,'Reembolso: sessão cancelada pelo organizador',bal);
   end if;
   update public.academia_reservations set status='cancelled' where id=r.id;
   insert into public.academia_session_notices(session_id,user_id,title,reason,refunded)
    values(s.id,r.user_id,s.title,btrim(p_reason),refund);
  end loop;
  update public.academia_sessions set status='cancelled',cancellation_reason=btrim(p_reason) where id=s.id;
 else raise exception 'Unknown action'; end if;
 insert into public.academia_session_actions(session_id,actor_id,action,reason)
 values(s.id,u,p_action,case when p_action='cancel' then btrim(p_reason) end);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.academia_manage_session(uuid,text,text) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.academia_manage_session(uuid,text,text) to authenticated;
create function public.academia_manage_session(p_session uuid,p_action text,p_reason text default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.academia_manage_session(p_session,p_action,p_reason);
$$;
revoke all on function public.academia_manage_session(uuid,text,text) from public,anon;
grant execute on function public.academia_manage_session(uuid,text,text) to authenticated;

-- Keep existing billing logic intact; lock the same session before every operation.
-- Private originals cannot be called directly through the Data API.
alter function public.academia_reserve(uuid) set schema private;
alter function public.academia_cancel(uuid) set schema private;
alter function public.academia_complete(uuid) set schema private;
revoke all on function private.academia_reserve(uuid),private.academia_cancel(uuid),private.academia_complete(uuid)
 from public,anon,authenticated;
create function public.academia_reserve(p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.academia_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into s from public.academia_sessions where id=p_session for update;
 if not found or s.deleted_at is not null or s.archived_at is not null or s.status='cancelled' then
  return jsonb_build_object('ok',false,'reason','closed'); end if;
 return private.academia_reserve(p_session);
end $$;
revoke all on function public.academia_reserve(uuid) from public,anon;
grant execute on function public.academia_reserve(uuid) to authenticated;
create function public.academia_cancel(p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.academia_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into s from public.academia_sessions where id=p_session for update;
 if not found or s.deleted_at is not null or s.archived_at is not null or s.status='cancelled' then
  return jsonb_build_object('ok',false,'reason','closed'); end if;
 return private.academia_cancel(p_session);
end $$;
revoke all on function public.academia_cancel(uuid) from public,anon;
grant execute on function public.academia_cancel(uuid) to authenticated;
create function public.academia_complete(p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.academia_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into s from public.academia_sessions where id=p_session for update;
 if not found or s.deleted_at is not null or s.archived_at is not null or s.status='cancelled' then
  return jsonb_build_object('ok',false,'reason','closed'); end if;
 return private.academia_complete(p_session);
end $$;
revoke all on function public.academia_complete(uuid) from public,anon;
grant execute on function public.academia_complete(uuid) to authenticated;
notify pgrst,'reload schema';
create function public.academia_my_notices()
 returns table(session_id uuid,title text,reason text,refunded integer)
 language sql stable security invoker set search_path='' as $$
 select session_id,title,reason,refunded from public.academia_session_notices
 where user_id=auth.uid() order by created_at desc limit 20;
 $$;
 revoke all on function public.academia_my_notices() from public,anon;
 grant execute on function public.academia_my_notices() to authenticated;

-- Direct learner refund requests must share the balance lock with organizer refunds.
alter function public.kumbu_refund(uuid,text,text) set schema private;
revoke all on function private.kumbu_refund(uuid,text,text) from public,anon,authenticated;
create function public.kumbu_refund(p_reference_id uuid,p_source text default null,p_description text default null)
returns json language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 return private.kumbu_refund(p_reference_id,p_source,p_description);
end $$;
revoke all on function public.kumbu_refund(uuid,text,text) from public,anon;
grant execute on function public.kumbu_refund(uuid,text,text) to authenticated;
