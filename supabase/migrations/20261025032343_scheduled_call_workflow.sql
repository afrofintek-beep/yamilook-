-- Atomic scheduling, bounded series, private admission and in-app reminders.
create schema if not exists private;
alter table public.scheduled_calls add column if not exists series_id uuid;
alter table public.scheduled_calls add column if not exists request_id uuid;
alter table public.scheduled_calls add column if not exists request_fingerprint text;
alter table public.scheduled_calls add column if not exists revision integer not null default 1;
create unique index if not exists scheduled_request_once on public.scheduled_calls(organizer_id,request_id) where request_id is not null;
create unique index if not exists scheduled_invitee_once on public.scheduled_call_invites(scheduled_call_id,user_id);
create index if not exists scheduled_series on public.scheduled_calls(series_id);
create index if not exists scheduled_due on public.scheduled_calls(scheduled_at) where status='scheduled';
create table if not exists private.scheduled_admission (
 call_id uuid not null references public.scheduled_calls(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 admitted boolean not null default false,
 primary key(call_id,user_id)
);
alter table private.scheduled_admission enable row level security;
create table if not exists public.scheduled_call_events (
 id uuid primary key default gen_random_uuid(),
 call_id uuid not null references public.scheduled_calls(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('invited','updated','cancelled','reminder')),
 revision integer not null,
 read_at timestamptz,
 created_at timestamptz not null default now(),
 unique(call_id,user_id,kind,revision)
);
alter table public.scheduled_call_events enable row level security;
create policy "Read own scheduled events" on public.scheduled_call_events for select to authenticated using(user_id=auth.uid());
grant select on public.scheduled_call_events to authenticated;
revoke all on private.scheduled_admission from public,anon,authenticated;
revoke insert,update,delete on public.scheduled_calls,public.scheduled_call_invites,public.scheduled_call_events from anon,authenticated;
-- Fix the original unqualified id, which resolved to the invite's own id.
drop policy if exists "Invitees can view scheduled calls" on public.scheduled_calls;
create policy "Invitees can view scheduled calls" on public.scheduled_calls for select to authenticated
 using(exists(select 1 from public.scheduled_call_invites i where i.scheduled_call_id=scheduled_calls.id and i.user_id=auth.uid()));

-- Narrow private definer: every action derives its actor from auth.uid().
create or replace function private.scheduled_action(p_action text,p_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); s public.scheduled_calls%rowtype; first_id uuid; new_id uuid;
 at_time timestamptz; zone text; pattern text; count_n integer; duration_n integer;
 invitees uuid[]; person uuid; n integer; local_start timestamp; occurrence timestamptz;
 request_key uuid; series_key uuid; result jsonb; target_status text;
begin
 if actor is null then raise exception 'unauthenticated'; end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.scheduled_at) from (
   select c.* from public.scheduled_calls c where (c.organizer_id=actor or exists(select 1 from public.scheduled_call_invites i where i.scheduled_call_id=c.id and i.user_id=actor))
   and (c.scheduled_at+make_interval(mins=>coalesce(c.duration_minutes,60))>now() or c.status='started') and c.status in ('scheduled','started')
   order by c.scheduled_at limit 200) q),'[]');
 end if;
 if p_action='events' then
  return coalesce((select jsonb_agg(to_jsonb(q)) from (
   select e.*, c.title from public.scheduled_call_events e join public.scheduled_calls c on c.id=e.call_id
   where e.user_id=actor and e.read_at is null and (e.kind<>'reminder' or (c.status in ('scheduled','started') and c.revision=e.revision and c.scheduled_at+make_interval(mins=>c.duration_minutes)>now())) order by e.created_at desc limit 30) q),'[]');
 end if;
 if p_action='ack' then
  update public.scheduled_call_events set read_at=now() where id=p_id and user_id=actor;
  if not found then raise exception 'not_found'; end if; return '{"ok":true}';
 end if;
 if p_action='create' then
  request_key:=(p_payload->>'request_id')::uuid;
  if request_key is null then raise exception 'request_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||request_key::text,0));
  select id into first_id from public.scheduled_calls where organizer_id=actor and request_id=request_key;
  if found then
   if (select request_fingerprint from public.scheduled_calls where id=first_id) is distinct from md5(p_payload::text) then raise exception 'request_conflict'; end if;
   return jsonb_build_object('id',first_id);
  end if;
 else
  select * into s from public.scheduled_calls where id=p_id for update;
  if not found or not(s.organizer_id=actor or exists(select 1 from public.scheduled_call_invites where scheduled_call_id=p_id and user_id=actor)) then raise exception 'not_allowed'; end if;
 end if;
 if p_action in ('create','edit') then
  if p_action='edit' and (s.organizer_id<>actor or s.status<>'scheduled') then raise exception 'organizer_required'; end if;
  if p_action='edit' and s.revision<>coalesce((p_payload->>'revision')::int,0) then raise exception 'stale_revision'; end if;
  at_time:=(p_payload->>'scheduled_at')::timestamptz;
  zone:=p_payload->>'timezone'; duration_n:=(p_payload->>'duration_minutes')::int;
  pattern:=nullif(p_payload->>'recurrence_pattern','none'); count_n:=coalesce((p_payload->>'occurrences')::int,1);
  if length(trim(coalesce(p_payload->>'title','')))=0 or length(p_payload->>'title')>120 or length(coalesce(p_payload->>'description',''))>2000 then raise exception 'invalid_title'; end if;
  if at_time is null or at_time<=now() or at_time>now()+interval '2 years' then raise exception 'invalid_date'; end if;
  if zone is null or not exists(select 1 from pg_timezone_names where name=zone) then raise exception 'invalid_timezone'; end if;
  if duration_n is null or duration_n not between 15 and 120 or p_payload->>'call_type' is null or p_payload->>'call_type' not in ('voice','video') then raise exception 'invalid_call'; end if;
  if pattern is not null and pattern not in ('daily','weekly','biweekly','monthly') then raise exception 'invalid_recurrence'; end if;
  if count_n not between 1 and 52 or (pattern is null and count_n<>1) then raise exception 'invalid_recurrence'; end if;
  select coalesce(array_agg(distinct x::uuid),'{}'::uuid[]) into invitees from jsonb_array_elements_text(coalesce(p_payload->'invitees','[]')) x;
  if cardinality(invitees)>31 then raise exception 'too_many_invitees'; end if;
  if actor=any(invitees) then raise exception 'invalid_invitee'; end if;
  -- Only existing contacts can be invited. A shared URL is not an access grant.
  if exists(select 1 from unnest(invitees) u where not exists(select 1 from public.contacts c where c.user_id=actor and c.contact_user_id=u and not c.is_blocked) or exists(select 1 from public.contacts c where c.user_id=u and c.contact_user_id=actor and c.is_blocked)) then raise exception 'contact_required'; end if;
  if p_action='edit' then
   update public.scheduled_calls set title=trim(p_payload->>'title'),description=p_payload->>'description',scheduled_at=at_time,timezone=zone,duration_minutes=duration_n,call_type=p_payload->>'call_type',waiting_room_enabled=coalesce((p_payload->>'waiting_room_enabled')::boolean,true),revision=revision+1 where id=p_id;
   -- Notify removed invitees as well, before removing their access.
   insert into public.scheduled_call_events(call_id,user_id,kind,revision)
   select p_id,i.user_id,'cancelled',s.revision+1 from public.scheduled_call_invites i where i.scheduled_call_id=p_id and not(i.user_id=any(invitees)) on conflict do nothing;
   delete from public.scheduled_call_invites where scheduled_call_id=p_id and not(user_id=any(invitees));
   delete from private.scheduled_admission where call_id=p_id;
   foreach person in array invitees loop
    insert into public.scheduled_call_invites(scheduled_call_id,user_id) values(p_id,person) on conflict(scheduled_call_id,user_id) do update set rsvp_status='pending',reminder_sent=false;
    insert into public.scheduled_call_events(call_id,user_id,kind,revision) values(p_id,person,'updated',s.revision+1) on conflict do nothing;
   end loop;
   return jsonb_build_object('id',p_id);
  end if;
  if (select count(*) from public.scheduled_calls where organizer_id=actor and scheduled_at>now() and status='scheduled')+count_n>200 then raise exception 'schedule_limit'; end if;
  series_key:=case when count_n>1 then gen_random_uuid() else null end;
  local_start:=at_time at time zone zone;
  for n in 0..count_n-1 loop
   occurrence:=(local_start+case pattern when 'daily' then make_interval(days=>n) when 'weekly' then make_interval(days=>7*n) when 'biweekly' then make_interval(days=>14*n) when 'monthly' then make_interval(months=>n) else interval '0' end) at time zone zone;
   if n=0 then occurrence:=at_time; end if;
   -- Reject nonexistent local times (DST gaps) instead of silently moving a meeting.
   if (occurrence at time zone zone) <> (local_start+case pattern when 'daily' then make_interval(days=>n) when 'weekly' then make_interval(days=>7*n) when 'biweekly' then make_interval(days=>14*n) when 'monthly' then make_interval(months=>n) else interval '0' end) then raise exception 'invalid_dst_time'; end if;
   insert into public.scheduled_calls(organizer_id,title,description,call_type,scheduled_at,timezone,duration_minutes,is_recurring,recurrence_pattern,waiting_room_enabled,invite_link,series_id,request_id,request_fingerprint)
   values(actor,trim(p_payload->>'title'),p_payload->>'description',p_payload->>'call_type',occurrence,zone,duration_n,pattern is not null,pattern,coalesce((p_payload->>'waiting_room_enabled')::boolean,true),gen_random_uuid()::text,series_key,case when n=0 then request_key else null end,case when n=0 then md5(p_payload::text) else null end) returning id into new_id;
   if n=0 then first_id:=new_id; end if;
   foreach person in array invitees loop
    insert into public.scheduled_call_invites(scheduled_call_id,user_id) values(new_id,person);
    insert into public.scheduled_call_events(call_id,user_id,kind,revision) values(new_id,person,'invited',1);
   end loop;
  end loop;
  return jsonb_build_object('id',first_id);
 end if;
 if p_action='detail' then
  select coalesce(jsonb_agg(jsonb_build_object('user_id',i.user_id,'rsvp_status',i.rsvp_status,'display_name',p.display_name,'waiting',a.user_id is not null and not a.admitted)), '[]') into result
  from public.scheduled_call_invites i left join public.profiles p on p.id=i.user_id left join private.scheduled_admission a on a.call_id=i.scheduled_call_id and a.user_id=i.user_id
  where i.scheduled_call_id=p_id and (s.organizer_id=actor or i.user_id=actor);
  return to_jsonb(s)||jsonb_build_object('invitees',result);
 end if;
 if p_action='rsvp' then
  target_status:=p_payload->>'status';
  if target_status is null or target_status not in ('accepted','declined','maybe') or s.status<>'scheduled' or s.scheduled_at+make_interval(mins=>s.duration_minutes)<=now() then raise exception 'invalid_rsvp'; end if;
  update public.scheduled_call_invites set rsvp_status=target_status where scheduled_call_id=p_id and user_id=actor;
  if not found then raise exception 'not_allowed'; end if;
  return '{"ok":true}';
 end if;
 if p_action='cancel' then
  if s.organizer_id<>actor then raise exception 'organizer_required'; end if;
  if s.status='cancelled' then return '{"ok":true}'; end if;
  if s.status<>'scheduled' then raise exception 'session_closed'; end if;
  for new_id in select id from public.scheduled_calls where organizer_id=actor and status='scheduled' and (id=p_id or (coalesce((p_payload->>'series')::boolean,false) and series_id=s.series_id and scheduled_at>=s.scheduled_at)) order by id for update loop
   update public.scheduled_calls set status='cancelled',revision=revision+1 where id=new_id;
   insert into public.scheduled_call_events(call_id,user_id,kind,revision) select new_id,i.user_id,'cancelled',c.revision from public.scheduled_call_invites i join public.scheduled_calls c on c.id=i.scheduled_call_id where c.id=new_id on conflict do nothing;
  end loop;
  return '{"ok":true}';
 end if;
 if p_action in ('start','join','access','admit','end') then
  if p_action='end' then
   if s.organizer_id<>actor then raise exception 'organizer_required'; end if;
   update public.scheduled_calls set status='completed' where id=p_id;
   return '{"ok":true}';
  end if;
  if s.status not in ('scheduled','started') or now()>s.scheduled_at+make_interval(mins=>s.duration_minutes) then raise exception 'session_closed'; end if;
  if now()<s.scheduled_at-interval '15 minutes' then raise exception 'too_early'; end if;
  if p_action='start' then
   if s.organizer_id<>actor then raise exception 'organizer_required'; end if;
   update public.scheduled_calls set status='started' where id=p_id; s.status:='started';
  end if;
  if s.status<>'started' then raise exception 'not_live'; end if;
  if p_action='admit' then
   if s.organizer_id<>actor then raise exception 'organizer_required'; end if;
   update private.scheduled_admission set admitted=true where call_id=p_id and user_id=(p_payload->>'user_id')::uuid;
   if not found then raise exception 'not_waiting'; end if;
   return '{"ok":true}';
  end if;
  if actor<>s.organizer_id then
   if exists(select 1 from public.scheduled_call_invites where scheduled_call_id=p_id and user_id=actor and rsvp_status='declined') then raise exception 'invitation_declined'; end if;
   if p_action='join' then insert into private.scheduled_admission(call_id,user_id,admitted) values(p_id,actor,not s.waiting_room_enabled) on conflict do nothing; end if;
   if s.waiting_room_enabled and not exists(select 1 from private.scheduled_admission where call_id=p_id and user_id=actor and admitted) then return '{"allowed":false,"reason":"waiting"}'; end if;
  end if;
  return jsonb_build_object('allowed',true,'is_host',actor=s.organizer_id,'title',s.title,'call_type',s.call_type,'ends_at',s.scheduled_at+make_interval(mins=>s.duration_minutes));
 end if;
 raise exception 'invalid_action';
end $$;
revoke all on function private.scheduled_action(text,uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.scheduled_action(text,uuid,jsonb) to authenticated;
create or replace function public.scheduled_call_action(p_action text,p_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$ select private.scheduled_action(p_action,p_id,p_payload) $$;
revoke all on function public.scheduled_call_action(text,uuid,jsonb) from public,anon;
grant execute on function public.scheduled_call_action(text,uuid,jsonb) to authenticated;

create or replace function private.scheduled_reminders() returns void language plpgsql security definer set search_path='' as $$
begin
 update public.scheduled_calls set status='completed' where status in ('scheduled','started') and scheduled_at+make_interval(mins=>coalesce(duration_minutes,60))<now();
 insert into public.scheduled_call_events(call_id,user_id,kind,revision)
 select c.id,recipients.user_id,'reminder',c.revision from public.scheduled_calls c cross join lateral (
  select c.organizer_id as user_id union select i.user_id from public.scheduled_call_invites i where i.scheduled_call_id=c.id and i.rsvp_status<>'declined'
 ) recipients where c.status='scheduled' and c.scheduled_at between now() and now()+interval '15 minutes' on conflict do nothing;
end $$;
revoke all on function private.scheduled_reminders() from public,anon,authenticated;
select cron.schedule('kosolola-call-reminders','* * * * *','select private.scheduled_reminders()');
