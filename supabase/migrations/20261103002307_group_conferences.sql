-- Group membership remains the authority; clients cannot write invitations or seats.
create schema if not exists private;
create table public.group_conferences (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 created_by uuid not null references public.profiles(id) on delete cascade,
 call_type text not null check(call_type in ('voice','video')),
 status text not null default 'active' check(status in ('active','ended')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '4 hours',
 ended_at timestamptz
);
create unique index group_conferences_one_active on public.group_conferences(conversation_id) where status='active';
create index group_conferences_creator on public.group_conferences(created_by);
create table public.group_conference_members (
 conference_id uuid not null references public.group_conferences(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 status text not null default 'invited' check(status in ('invited','joined','declined','left')),
 device_id uuid,
 lease_until timestamptz,
 invited_at timestamptz not null default now(),
 primary key(conference_id,user_id)
);
create index group_conference_member_user on public.group_conference_members(user_id,conference_id);
alter table public.group_conferences enable row level security;
alter table public.group_conference_members enable row level security;
revoke all on public.group_conferences,public.group_conference_members from public,anon,authenticated;
grant select on public.group_conferences,public.group_conference_members to authenticated;
create policy group_conference_read on public.group_conferences for select to authenticated
 using(public.user_is_participant(conversation_id));
create policy group_conference_member_read on public.group_conference_members for select to authenticated
 using(exists(select 1 from public.group_conferences c where c.id=conference_id and public.user_is_participant(c.conversation_id)));

-- One transaction serializes capacity, lifecycle, and device claims per conference.
create or replace function private.group_conference_action(p_action text,p_id uuid,p_payload jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); c public.group_conferences; m public.group_conference_members;
 peer uuid; peers uuid[]; device uuid; conv uuid; result jsonb; title text;
begin
 if actor is null then raise exception 'unauthenticated' using errcode='42501'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into result from (
   select conf.id,conf.conversation_id,conf.created_by,conf.call_type,conf.status,conf.created_at,v.name,member.status as invitation_status
   from public.group_conferences conf join public.conversations v on v.id=conf.conversation_id
   join public.group_conference_members member on member.conference_id=conf.id and member.user_id=actor
   where conf.status='active' and conf.expires_at>now() and member.status in ('invited','joined')
    and (conf.created_at>now()-interval '2 minutes' or exists(select 1 from public.group_conference_members active where active.conference_id=conf.id and active.status='joined' and active.lease_until>now()))
    and exists(select 1 from public.conversation_participants cp where cp.conversation_id=conf.conversation_id and cp.user_id=actor)
   order by conf.created_at desc limit 20
  ) x;
  return result;
 end if;
 if p_action='current' then
  if not exists(select 1 from public.conversation_participants where conversation_id=p_id and user_id=actor) then raise exception 'not_allowed' using errcode='42501'; end if;
  select to_jsonb(conf)||jsonb_build_object('name',v.name,'invitation_status',member.status) into result
   from public.group_conferences conf join public.conversations v on v.id=conf.conversation_id
   left join public.group_conference_members member on member.conference_id=conf.id and member.user_id=actor
   where conf.conversation_id=p_id and conf.status='active' and conf.expires_at>now()
   and (conf.created_at>now()-interval '2 minutes' or exists(select 1 from public.group_conference_members active where active.conference_id=conf.id and active.status='joined' and active.lease_until>now()));
  return result;
 end if;
 if p_action='create' then
  conv:=p_id;
  if not exists(select 1 from public.conversations v join public.conversation_participants cp on cp.conversation_id=v.id
    where v.id=conv and v.type='group' and cp.user_id=actor) then raise exception 'not_allowed' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(conv::text,41));
  -- Reconcile rooms abandoned before media setup or after all leases expired.
  update public.group_conferences old set status='ended',ended_at=now() where old.conversation_id=conv and old.status='active'
   and (old.expires_at<=now() or (old.created_at<now()-interval '2 minutes' and not exists(select 1 from public.group_conference_members s where s.conference_id=old.id and s.status='joined' and s.lease_until>now())));
  if exists(select 1 from public.group_conferences where conversation_id=conv and status='active') then raise exception 'conference_exists'; end if;
  if coalesce(p_payload->>'call_type','') not in ('voice','video') then raise exception 'invalid_request'; end if;
  peers:=array(select distinct value::uuid from jsonb_array_elements_text(p_payload->'user_ids') where value::uuid<>actor);
  if cardinality(peers) not between 1 and 7 then raise exception 'choose_one_to_seven'; end if;
  insert into public.group_conferences(conversation_id,created_by,call_type) values(conv,actor,p_payload->>'call_type') returning * into c;
  insert into public.group_conference_members(conference_id,user_id) values(c.id,actor);
 else
  select * into c from public.group_conferences where id=p_id for update;
  if not found or not exists(select 1 from public.conversation_participants cp where cp.conversation_id=c.conversation_id and cp.user_id=actor) then
   raise exception 'not_allowed' using errcode='42501';
  end if;
  if p_action='detail' then
   select v.name into title from public.conversations v where v.id=c.conversation_id;
   select coalesce(jsonb_agg(jsonb_build_object('user_id',member.user_id,'status',member.status,'display_name',p.display_name)),'[]'::jsonb)
   into result from public.group_conference_members member join public.profiles p on p.id=member.user_id where member.conference_id=c.id;
   return to_jsonb(c)||jsonb_build_object('name',title,'members',result);
  end if;
  if p_action='end' then
   if c.created_by<>actor then raise exception 'organizer_required' using errcode='42501'; end if;
   update public.group_conferences set status='ended',ended_at=coalesce(ended_at,now()) where id=c.id;
   update public.group_conference_members set status='left',lease_until=null where conference_id=c.id and status in ('invited','joined');
   return jsonb_build_object('ok',true);
  end if;
  select * into m from public.group_conference_members where conference_id=c.id and user_id=actor;
  if p_action in ('leave','decline') then
   if m.user_id is null then raise exception 'not_invited' using errcode='42501'; end if;
   device:=nullif(p_payload->>'device_id','')::uuid;
   if p_action='leave' and m.device_id is distinct from device then return jsonb_build_object('ok',false); end if;
   if p_action='decline' and m.status<>'invited' then return jsonb_build_object('ok',false); end if;
   update public.group_conference_members set status=case when p_action='decline' then 'declined' else 'left' end,lease_until=null
     where conference_id=c.id and user_id=actor;
   if not exists(select 1 from public.group_conference_members where conference_id=c.id and status='joined' and lease_until>now())
    and (p_action='leave' or not exists(select 1 from public.group_conference_members where conference_id=c.id and status='invited')) then
    update public.group_conferences set status='ended',ended_at=now() where id=c.id;
    update public.group_conference_members set status='left',lease_until=null where conference_id=c.id and status in ('invited','joined');
   end if;
   return jsonb_build_object('ok',true);
  end if;
  if c.status<>'active' or c.expires_at<=now() then raise exception 'conference_closed'; end if;
  if p_action='sweep' then
   if m.user_id is null or m.status<>'joined' then raise exception 'not_allowed' using errcode='42501'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('identity',stale.user_id::text||':'||stale.device_id::text)),'[]'::jsonb) into result
   from public.group_conference_members stale where stale.conference_id=c.id and stale.device_id is not null and stale.status='joined'
    and (stale.lease_until<=now() or not exists(select 1 from public.conversation_participants cp where cp.conversation_id=c.conversation_id and cp.user_id=stale.user_id));
   update public.group_conference_members stale set status='left',lease_until=null where stale.conference_id=c.id and stale.status='joined'
    and (stale.lease_until<=now() or not exists(select 1 from public.conversation_participants cp where cp.conversation_id=c.conversation_id and cp.user_id=stale.user_id));
   select jsonb_build_object('removed',result,'allowed',coalesce(jsonb_agg(live.user_id::text||':'||live.device_id::text),'[]'::jsonb)) into result
   from public.group_conference_members live where live.conference_id=c.id and live.status='joined' and live.lease_until>now();
   return result;
  end if;
  if p_action='invite' then
   update public.group_conference_members set status='left' where conference_id=c.id and status='joined' and lease_until<now();
   if m.status<>'joined' or m.lease_until<=now() or m.user_id is null then raise exception 'not_allowed' using errcode='42501'; end if;
   peers:=array(select distinct value::uuid from jsonb_array_elements_text(p_payload->'user_ids') where value::uuid<>actor);
   if cardinality(peers) not between 1 and 7 then raise exception 'choose_one_to_seven'; end if;
  elsif p_action in ('join','heartbeat') then
   device:=nullif(p_payload->>'device_id','')::uuid;
   if device is null or m.user_id is null or m.status not in ('invited','joined','left','declined') then raise exception 'not_invited' using errcode='42501'; end if;
   if p_action='heartbeat' and (m.status<>'joined' or m.device_id is distinct from device) then raise exception 'session_lost'; end if;
   if m.status='joined' and m.lease_until>now() and m.device_id is distinct from device then raise exception 'another_device'; end if;
   if exists(select 1 from public.blocked_users b join public.group_conference_members other on other.conference_id=c.id and other.status='joined'
    where (b.blocker_id=actor and b.blocked_id=other.user_id) or (b.blocked_id=actor and b.blocker_id=other.user_id)) then raise exception 'participant_unavailable'; end if;
   perform pg_advisory_xact_lock(hashtextextended(actor::text,42));
   if exists(select 1 from public.group_conference_members s join public.group_conferences other on other.id=s.conference_id
    where s.user_id=actor and s.conference_id<>c.id and s.status='joined' and s.lease_until>now() and other.status='active' and other.expires_at>now()) then raise exception 'caller_busy'; end if;
   if exists(select 1 from public.call_participants cp join public.calls call on call.id=cp.call_id
    where cp.user_id=actor and cp.status in ('ringing','connected') and call.status in ('ringing','connecting','ongoing')) then raise exception 'caller_busy'; end if;
   if (select count(*) from public.group_conference_members s where s.conference_id=c.id and s.user_id<>actor and s.status='joined' and s.lease_until>now())>=8 then raise exception 'conference_full'; end if;
   update public.group_conference_members set status='joined',device_id=device,lease_until=now()+interval '90 seconds' where conference_id=c.id and user_id=actor;
   return jsonb_build_object('allowed',true,'is_host',c.created_by=actor,'call_type',c.call_type,'expires_at',c.expires_at);
  else raise exception 'invalid_action'; end if;
 end if;
 -- Shared validated invitation path for create and invite. No arbitrary identities.
 if (select count(*) from public.conversation_participants where conversation_id=c.conversation_id and user_id=any(peers))<>cardinality(peers) then raise exception 'participant_unavailable'; end if;
 if exists(select 1 from public.blocked_users where (blocker_id=actor and blocked_id=any(peers)) or (blocked_id=actor and blocker_id=any(peers))) then raise exception 'participant_unavailable'; end if;
 if (select count(*) from public.group_conference_members where conference_id=c.id and status in ('joined','invited') and not(user_id=any(peers)))+cardinality(peers)>8 then raise exception 'conference_full'; end if;
 foreach peer in array peers loop
  insert into public.group_conference_members(conference_id,user_id) values(c.id,peer)
   on conflict(conference_id,user_id) do update set status='invited',device_id=null,lease_until=null,invited_at=now()
   where public.group_conference_members.status in ('left','declined');
 end loop;
 return to_jsonb(c);
end $$;
revoke all on function private.group_conference_action(text,uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.group_conference_action(text,uuid,jsonb) to authenticated;
create or replace function public.group_conference_action(p_action text,p_id uuid default null,p_payload jsonb default '{}'::jsonb)
 returns jsonb language sql security invoker set search_path='' as $$ select private.group_conference_action(p_action,p_id,p_payload) $$;
revoke all on function public.group_conference_action(text,uuid,jsonb) from public,anon;
grant execute on function public.group_conference_action(text,uuid,jsonb) to authenticated;
-- Realtime is an acceleration; authenticated RPC polling remains the fallback.
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then
  alter publication supabase_realtime add table public.group_conferences,public.group_conference_members;
 end if;
end $$;

-- Direct calls also honor conference occupancy, including other devices.
create or replace function private.guard_direct_call_conference() returns trigger
 language plpgsql security definer set search_path='' as $$
declare participant uuid;
begin
 if new.status not in ('ringing','connecting','ongoing') then return new; end if;
 for participant in select distinct u from unnest(array[coalesce(new.caller_id,new.initiator_id),new.callee_id]) u where u is not null order by u loop
  perform pg_advisory_xact_lock(hashtextextended(participant::text,42));
  if exists(select 1 from public.group_conference_members m join public.group_conferences c on c.id=m.conference_id
   where m.user_id=participant and m.status='joined' and m.lease_until>now() and c.status='active' and c.expires_at>now()) then
   if participant=coalesce(new.caller_id,new.initiator_id) then raise exception 'caller_busy'; else raise exception 'callee_busy'; end if;
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.guard_direct_call_conference() from public,anon,authenticated;
create trigger guard_direct_call_conference before insert or update of status on public.calls
 for each row execute function private.guard_direct_call_conference();
