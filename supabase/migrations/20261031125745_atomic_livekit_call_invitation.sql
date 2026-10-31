-- The transport marker and ringing invitation must become visible together.
-- Keep create_call unchanged for older WebRTC clients.
create or replace function public.create_livekit_call(
  p_callee_id uuid,p_call_type text default 'voice',p_conversation_id uuid default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  v_id := public.create_call(p_callee_id,p_call_type,p_conversation_id);
  update public.calls set sdp_offer=jsonb_build_object('transport','livekit-v1') where id=v_id;
  return v_id;
end;
$$;
revoke all on function public.create_livekit_call(uuid,text,uuid) from public,anon;
grant execute on function public.create_livekit_call(uuid,text,uuid) to authenticated;

-- Server-owned reconnection grace. Browser timers and app visibility are not
-- reliable leases on mobile; reconcile against actual LiveKit participants.
create table public.direct_call_recovery_observations (
  call_id uuid primary key references public.calls(id) on delete cascade,
  first_missing_at timestamptz not null default now()
);
alter table public.direct_call_recovery_observations enable row level security;
revoke all on public.direct_call_recovery_observations from public,anon,authenticated;
grant select,insert,delete on public.direct_call_recovery_observations to service_role;

-- Legacy clients may still invoke this RPC. Never expire an ongoing call just
-- because its row has not changed: the media server owns presence.
create or replace function public.cleanup_stuck_calls()
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode='42501'; end if;
  update public.calls set
    status=case when status='ringing' then 'missed' else 'failed' end,
    end_reason=case when status='ringing' then 'no_answer' else 'setup_timeout' end,
    ended_at=now(),updated_at=now()
  where (status='ringing' and created_at<now()-interval '90 seconds')
     or (status in ('initiated','connecting') and updated_at<now()-interval '120 seconds');
  get diagnostics v_count=row_count;
  update public.call_participants cp set status='left',left_at=now()
    from public.calls c where cp.call_id=c.id and c.status in ('ended','missed','declined','failed')
      and cp.status in ('ringing','connected','on_hold','waiting','invited');
  return v_count;
end;
$$;
revoke all on function public.cleanup_stuck_calls() from public,anon;
grant execute on function public.cleanup_stuck_calls() to authenticated;
