
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
  ) THEN RAISE EXCEPTION 'callee_busy'; END IF;

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

-- Authoritative terminal transitions for direct calls. A delayed timeout or
-- cancellation must never overwrite an answered/declined/finished call.
CREATE OR REPLACE FUNCTION public.finish_direct_call(p_call_id uuid, p_outcome text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.calls%ROWTYPE; actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  SELECT * INTO c FROM public.calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR c.is_group_call OR actor NOT IN (c.caller_id,c.callee_id)
     OR (actor IS DISTINCT FROM c.caller_id AND actor IS DISTINCT FROM c.callee_id)
  THEN RAISE EXCEPTION 'not_allowed'; END IF;
  IF p_outcome NOT IN ('completed','cancelled','declined','no_answer') OR p_outcome IS NULL
    THEN RAISE EXCEPTION 'invalid_outcome'; END IF;
  IF p_outcome IN ('cancelled','no_answer') AND actor IS DISTINCT FROM c.caller_id
    THEN RAISE EXCEPTION 'caller_required'; END IF;
  IF p_outcome = 'declined' AND actor IS DISTINCT FROM c.callee_id
    THEN RAISE EXCEPTION 'callee_required'; END IF;
  IF c.status NOT IN ('initiated','ringing','connecting','ongoing') THEN RETURN false; END IF;
  IF p_outcome IN ('no_answer','declined') AND c.status = 'ongoing' THEN RETURN false; END IF;
  IF p_outcome = 'no_answer' AND c.created_at > now() - interval '60 seconds' THEN RETURN false; END IF;
  -- If the peer answered just as the caller hung up, finish the active call.
  IF p_outcome = 'cancelled' AND c.started_at IS NOT NULL THEN p_outcome := 'completed'; END IF;
  IF p_outcome = 'completed' AND c.started_at IS NULL THEN p_outcome := 'cancelled'; END IF;
  UPDATE public.calls SET
    status = CASE WHEN p_outcome = 'no_answer' THEN 'missed' WHEN p_outcome = 'declined' THEN 'declined' ELSE 'ended' END,
    end_reason = p_outcome, ended_at = now(),
    duration_seconds = CASE WHEN c.started_at IS NULL THEN 0 ELSE greatest(0,extract(epoch FROM now()-c.started_at)::integer) END
  WHERE id = p_call_id;
  UPDATE public.call_participants SET status = CASE WHEN p_outcome IN ('declined','no_answer') AND user_id = c.callee_id THEN 'declined' ELSE 'left' END,
    left_at = now() WHERE call_id = p_call_id AND status IN ('invited','ringing','waiting','connected','on_hold');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_direct_call(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_direct_call(uuid,text) TO authenticated;

-- First answering device claims the invitation before opening media. A second
-- device gets false and must not connect with the same LiveKit identity.
CREATE OR REPLACE FUNCTION public.claim_direct_call(p_call_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  UPDATE public.calls SET status = 'connecting'
  WHERE id = p_call_id AND callee_id = auth.uid() AND NOT is_group_call
    AND status = 'ringing' AND created_at > now() - interval '90 seconds'
  RETURNING id INTO claimed;
  RETURN claimed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_direct_call(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_direct_call(uuid) TO authenticated;
