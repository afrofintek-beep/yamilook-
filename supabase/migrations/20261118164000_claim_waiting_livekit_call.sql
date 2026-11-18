create function public.claim_waiting_livekit_call(p_call_id uuid, p_held_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_call_id = p_held_id then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,7841));
  perform 1 from public.calls where id in (p_call_id,p_held_id) order by id for update;
  if not exists(select 1 from public.calls where id=p_held_id and status='ongoing'
    and actor in (initiator_id,callee_id) and not is_group_call and sdp_offer->>'transport'='livekit-v1')
    or exists(select 1 from public.calls c join public.call_participants cp on cp.call_id=c.id
      where cp.user_id=actor and cp.status in ('connected','on_hold','ringing')
      and c.id not in (p_call_id,p_held_id) and c.status in ('ongoing','connecting','ringing'))
  then return false; end if;
  update public.calls set status='connecting' where id=p_call_id and callee_id=actor and not is_group_call
    and sdp_offer->>'transport'='livekit-v1' and status='ringing' and created_at>now()-interval '90 seconds';
  return found;
end $$;
revoke all on function public.claim_waiting_livekit_call(uuid,uuid) from public,anon;
grant execute on function public.claim_waiting_livekit_call(uuid,uuid) to authenticated;
