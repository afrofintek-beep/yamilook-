-- Convert only an authorized ongoing direct call and its pending invitation.
-- No media admission is granted: every participant must accept the conference.
create or replace function private.add_waiting_call_to_conference(p_current_call_id uuid,p_waiting_call_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); current_call public.calls%rowtype; waiting_call public.calls%rowtype;
 peer uuid; newcomer uuid; members uuid[]; conv uuid; conf uuid;
begin
 if actor is null then raise exception 'unauthenticated'; end if;
 if p_current_call_id is null or p_waiting_call_id is null or p_current_call_id=p_waiting_call_id then raise exception 'invalid_call'; end if;
 select * into current_call from public.calls where id=p_current_call_id;
 if not found or current_call.is_group_call is distinct from false or
  (actor is distinct from current_call.caller_id and actor is distinct from current_call.callee_id) then raise exception 'not_allowed'; end if;
 select * into waiting_call from public.calls where id=p_waiting_call_id;
 if not found or waiting_call.is_group_call is distinct from false or waiting_call.callee_id is distinct from actor then raise exception 'not_allowed'; end if;
 peer:=case when current_call.caller_id=actor then current_call.callee_id else current_call.caller_id end;
 newcomer:=waiting_call.caller_id;
 if peer is null or newcomer is null or peer=actor or newcomer in (actor,peer) then raise exception 'invalid_call'; end if;
 members:=array[actor,peer,newcomer];
 -- Match direct-call admission lock ordering, then conference admission locks.
 perform pg_advisory_xact_lock(hashtextextended(id::text,7841)) from unnest(members) id order by id;
 perform pg_advisory_xact_lock(hashtextextended(id::text,42)) from unnest(members) id order by id;
 perform 1 from public.calls where id in (p_current_call_id,p_waiting_call_id) order by id for update;
 select * into current_call from public.calls where id=p_current_call_id;
 select * into waiting_call from public.calls where id=p_waiting_call_id;
 if current_call.status is distinct from 'ongoing' or current_call.is_group_call is distinct from false
  or current_call.sdp_offer->>'transport' is distinct from 'livekit-v1'
  or not ((current_call.caller_id=actor and current_call.callee_id=peer) or (current_call.caller_id=peer and current_call.callee_id=actor))
  or waiting_call.status is distinct from 'ringing' or waiting_call.is_group_call is distinct from false
  or waiting_call.callee_id is distinct from actor or waiting_call.caller_id is distinct from newcomer
  or waiting_call.created_at<=now()-interval '90 seconds' then raise exception 'call_unavailable'; end if;
 if exists(select 1 from public.blocked_users where blocker_id=any(members) and blocked_id=any(members))
  or exists(select 1 from public.contacts where is_blocked and user_id=any(members) and contact_user_id=any(members)) then
  raise exception 'call_unavailable'; end if;
 if exists(select 1 from public.calls c join public.call_participants cp on cp.call_id=c.id
  where cp.user_id=any(members) and c.id not in (p_current_call_id,p_waiting_call_id)
  and cp.status in ('ringing','connected','on_hold') and c.status in ('initiated','ringing','connecting','ongoing')
  and (c.status='ongoing' or c.created_at>now()-interval '90 seconds'))
  or exists(select 1 from public.group_conferences c join public.group_conference_members m on m.conference_id=c.id
   where m.user_id=any(members) and m.status='joined' and m.lease_until>now() and c.status='active' and c.expires_at>now()) then
  raise exception 'caller_busy'; end if;
 -- Fresh conversation: never expose either direct conversation's message history.
 insert into public.conversations(type,name,created_by) values('group','KOSOLOLA',actor) returning id into conv;
 insert into public.conversation_participants(conversation_id,user_id,role)
  select conv,id,case when id=actor then 'admin'::public.group_member_role else 'member'::public.group_member_role end from unnest(members) id;
 -- Voice avoids enabling a camera for a participant who accepted only voice.
 insert into public.group_conferences(conversation_id,created_by,call_type) values(conv,actor,'voice') returning id into conf;
 insert into public.group_conference_members(conference_id,user_id) select conf,id from unnest(members) id;
 perform public.finish_direct_call(p_current_call_id,'completed');
 perform public.finish_direct_call(p_waiting_call_id,'completed');
 return conf;
end $$;
revoke all on function private.add_waiting_call_to_conference(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.add_waiting_call_to_conference(uuid,uuid) to authenticated;
create or replace function public.add_waiting_call_to_conference(p_current_call_id uuid,p_waiting_call_id uuid)
returns uuid language sql security invoker set search_path='' as $$
 select private.add_waiting_call_to_conference(p_current_call_id,p_waiting_call_id)
$$;
revoke all on function public.add_waiting_call_to_conference(uuid,uuid) from public,anon;
grant execute on function public.add_waiting_call_to_conference(uuid,uuid) to authenticated;
