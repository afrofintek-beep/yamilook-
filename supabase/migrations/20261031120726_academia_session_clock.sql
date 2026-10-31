-- Preserve actual timing across reconnects; never guess a historic start time.
alter table public.academia_sessions
 add column duration_minutes integer not null default 60 check (duration_minutes between 15 and 480),
 add column started_at timestamptz,
 add column ended_at timestamptz;

create function private.academia_clock_guard() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
  new.started_at := null; new.ended_at := null;
 else
  new.started_at := old.started_at; new.ended_at := old.ended_at;
  if old.status='scheduled' and new.status='live' then new.started_at:=now(); end if;
  if old.status='live' and new.status in ('ended','completed','cancelled') then new.ended_at:=now(); end if;
  if new.duration_minutes is distinct from old.duration_minutes then
   if old.status not in ('scheduled','live') or new.mentor_id is distinct from auth.uid() then
    raise exception 'mentor_required' using errcode='42501';
   end if;
   if old.status='live' and new.duration_minutes<=old.duration_minutes then raise exception 'extension_required'; end if;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.academia_clock_guard() from public,anon,authenticated;
create trigger academia_clock_guard before insert or update on public.academia_sessions
 for each row execute function private.academia_clock_guard();

-- Narrow trigger privilege is used only to append the existing protected audit log.
create function private.academia_clock_audit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.started_at is distinct from old.started_at or new.ended_at is distinct from old.ended_at
    or new.duration_minutes is distinct from old.duration_minutes then
  insert into public.academia_session_actions(session_id,actor_id,action,reason)
  values(new.id,coalesce(auth.uid(),new.mentor_id),'session_timing',
   jsonb_build_object('started_at',new.started_at,'ended_at',new.ended_at,'duration_minutes',new.duration_minutes)::text);
 end if;
 return new;
end $$;
revoke all on function private.academia_clock_audit() from public,anon,authenticated;
create trigger academia_clock_audit after update on public.academia_sessions
 for each row execute function private.academia_clock_audit();
