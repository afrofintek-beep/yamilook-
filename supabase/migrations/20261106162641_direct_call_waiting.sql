-- One active direct call plus one incoming invitation; never two live media sessions.

-- Create the missing create_call RPC function
-- This is called by useCallLifecycle.createCallInDB to initiate a call
CREATE OR REPLACE FUNCTION public.create_call(
  p_callee_id UUID,
  p_call_type TEXT DEFAULT 'voice',
  p_conversation_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_call_id UUID;
  v_caller_id UUID;
BEGIN
  -- Get the authenticated user
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_callee_id THEN
    RAISE EXCEPTION 'Cannot call yourself';
  END IF;

  IF p_callee_id IS NULL OR p_call_type IS NULL OR p_call_type NOT IN ('voice', 'video') THEN
    RAISE EXCEPTION 'invalid_call';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_callee_id) OR EXISTS (
    SELECT 1 FROM public.contacts WHERE is_blocked AND
      ((user_id = v_caller_id AND contact_user_id = p_callee_id) OR
       (user_id = p_callee_id AND contact_user_id = v_caller_id))
  ) OR EXISTS (SELECT 1 FROM public.blocked_users WHERE
    (blocker_id=v_caller_id AND blocked_id=p_callee_id) OR
    (blocker_id=p_callee_id AND blocked_id=v_caller_id)
  ) THEN RAISE EXCEPTION 'call_unavailable'; END IF;

  -- Serialize both accounts in deterministic order, including crossed calls.
  -- All devices calling through this RPC share the same locks.
  PERFORM pg_advisory_xact_lock(hashtextextended(id::text, 7841))
    FROM (SELECT v_caller_id AS id UNION SELECT p_callee_id) accounts ORDER BY id;

  IF EXISTS (
    SELECT 1 FROM public.calls c JOIN public.call_participants cp ON cp.call_id = c.id
    WHERE cp.user_id = v_caller_id AND cp.status IN ('ringing','connected','on_hold')
      AND c.status IN ('initiated','ringing','connecting','ongoing')
      AND (c.status = 'ongoing' OR c.created_at > now() - interval '90 seconds')
  ) THEN RAISE EXCEPTION 'caller_busy'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.calls c JOIN public.call_participants cp ON cp.call_id = c.id
    WHERE cp.user_id = p_callee_id AND cp.status IN ('ringing','connected','on_hold')
      AND c.status IN ('initiated','ringing','connecting','ongoing')
      AND (c.status = 'ongoing' OR c.created_at > now() - interval '90 seconds')
      -- One ongoing LiveKit conversation may receive ONE ringing invitation.
      AND (c.status <> 'ongoing' OR c.is_group_call IS DISTINCT FROM false
           OR c.sdp_offer->>'transport' IS DISTINCT FROM 'livekit-v1')
  ) OR (SELECT count(*) FROM public.calls c JOIN public.call_participants cp ON cp.call_id=c.id
        WHERE cp.user_id=p_callee_id AND cp.status IN ('connected','on_hold') AND c.status='ongoing') > 1
    THEN RAISE EXCEPTION 'callee_busy'; END IF;

  -- Create the call record
  INSERT INTO public.calls (
    initiator_id,
    caller_id,
    callee_id,
    type,
    call_type,
    status,
    is_group_call,
    conversation_id,
    max_participants,
    is_locked,
    waiting_room_enabled,
    recording_enabled
  ) VALUES (
    v_caller_id,
    v_caller_id,
    p_callee_id,
    p_call_type,
    p_call_type,
    'ringing',
    false,
    p_conversation_id,
    2,
    false,
    false,
    false
  )
  RETURNING id INTO v_call_id;

  -- Add caller as participant (host)
  INSERT INTO public.call_participants (
    call_id,
    user_id,
    role,
    status,
    is_muted,
    is_video_enabled,
    is_screen_sharing,
    is_hand_raised,
    is_spotlight
  ) VALUES (
    v_call_id,
    v_caller_id,
    'host',
    'connected',
    false,
    p_call_type = 'video',
    false,
    false,
    false
  );

  -- Add callee as participant (waiting to be answered)
  INSERT INTO public.call_participants (
    call_id,
    user_id,
    role,
    status,
    is_muted,
    is_video_enabled,
    is_screen_sharing,
    is_hand_raised,
    is_spotlight
  ) VALUES (
    v_call_id,
    p_callee_id,
    'participant',
    'ringing',
    false,
    p_call_type = 'video',
    false,
    false,
    false
  );

  RETURN v_call_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.create_call(UUID, TEXT, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.create_call(uuid,text,uuid) FROM PUBLIC, anon;


-- Every device must finish its existing conversation before claiming another.
create or replace function public.claim_direct_call(p_call_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); claimed uuid;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,7841));
  if exists(select 1 from public.calls c join public.call_participants cp on cp.call_id=c.id
    where cp.user_id=actor and c.id<>p_call_id and cp.status in ('connected','on_hold','ringing')
      and c.status in ('initiated','ringing','connecting','ongoing')
      and (c.status='ongoing' or c.created_at>now()-interval '90 seconds')) then
    raise exception 'caller_busy';
  end if;
  update public.calls set status='connecting'
    where id=p_call_id and callee_id=actor and not is_group_call
      and status='ringing' and created_at>now()-interval '90 seconds'
    returning id into claimed;
  return claimed is not null;
end $$;
revoke all on function public.claim_direct_call(uuid) from public,anon;
grant execute on function public.claim_direct_call(uuid) to authenticated;

-- Explicit end-and-answer only. This does not hold or mix two media sessions.
create or replace function private.end_direct_call_for_waiting(p_current_call_id uuid,p_waiting_call_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); current_call public.calls%rowtype; waiting_call public.calls%rowtype;
begin
  if actor is null then raise exception 'unauthenticated'; end if;
  if p_current_call_id is null or p_waiting_call_id is null or p_current_call_id=p_waiting_call_id then raise exception 'invalid_call'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,7841));
  perform 1 from public.calls where id in (p_current_call_id,p_waiting_call_id) order by id for update;
  select * into current_call from public.calls where id=p_current_call_id;
  if not found or current_call.is_group_call is distinct from false or
    (actor is distinct from current_call.caller_id and actor is distinct from current_call.callee_id) then raise exception 'not_allowed'; end if;
  select * into waiting_call from public.calls where id=p_waiting_call_id;
  if not found or waiting_call.is_group_call is distinct from false or waiting_call.callee_id is distinct from actor then raise exception 'not_allowed'; end if;
  if waiting_call.status<>'ringing' or waiting_call.created_at<=now()-interval '90 seconds' then return false; end if;
  if current_call.status in ('initiated','ringing','connecting','ongoing') then
    perform public.finish_direct_call(p_current_call_id,'completed');
  end if;
  return true;
end $$;
revoke all on function private.end_direct_call_for_waiting(uuid,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.end_direct_call_for_waiting(uuid,uuid) to authenticated;
create or replace function public.end_direct_call_for_waiting(p_current_call_id uuid,p_waiting_call_id uuid)
returns boolean language sql security invoker set search_path='' as $$
  select private.end_direct_call_for_waiting(p_current_call_id,p_waiting_call_id)
$$;
revoke all on function public.end_direct_call_for_waiting(uuid,uuid) from public,anon;
grant execute on function public.end_direct_call_for_waiting(uuid,uuid) to authenticated;
