-- Bearer invitations for device contacts. Existing email-bound invitations are unchanged.
BEGIN;
ALTER TABLE public.user_invitations ALTER COLUMN recipient_email DROP NOT NULL;
ALTER TABLE public.user_invitations ADD COLUMN expires_at timestamptz;
ALTER TABLE public.user_invitations ADD COLUMN request_id uuid;
ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_shareable_expiry
  CHECK (recipient_email IS NOT NULL OR (expires_at IS NOT NULL AND request_id IS NOT NULL));
CREATE UNIQUE INDEX user_invitations_request ON public.user_invitations(invited_by, request_id)
  WHERE request_id IS NOT NULL;

CREATE FUNCTION public.issue_shareable_user_invitation(p_request_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid := auth.uid(); v_invite public.user_invitations%ROWTYPE; v_code text;
BEGIN
  IF v_owner IS NULL OR NOT public.can_issue_user_invitation(v_owner) THEN
    RAISE EXCEPTION 'Só uma pessoa autorizada pode enviar convites.' USING ERRCODE = '42501';
  END IF;
  IF p_request_id IS NULL THEN RAISE EXCEPTION 'Pedido inválido'; END IF;
  -- Serialize the issuer, covering retries, parallel requests and the daily limit.
  PERFORM pg_advisory_xact_lock(hashtextextended('shareable-invite:' || v_owner::text, 0));
  SELECT * INTO v_invite FROM public.user_invitations
    WHERE invited_by = v_owner AND request_id = p_request_id;
  IF FOUND THEN
    IF v_invite.used_at IS NOT NULL OR v_invite.expires_at <= now() THEN
      RAISE EXCEPTION 'Cria um novo convite para esta pessoa.';
    END IF;
    RETURN json_build_object('code', v_invite.code, 'expires_at', v_invite.expires_at);
  END IF;
  IF (SELECT count(*) FROM public.user_invitations WHERE invited_by = v_owner
      AND request_id IS NOT NULL AND created_at >= now() - interval '24 hours') >= 100 THEN
    RAISE EXCEPTION 'Limite diário de convites atingido. Tenta mais tarde.';
  END IF;
  LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_invitations WHERE code = v_code)
      AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(referral_code) = v_code)
      AND NOT EXISTS (SELECT 1 FROM public.mvp_candidates WHERE upper(access_code) = v_code);
  END LOOP;
  INSERT INTO public.user_invitations(code, invited_by, recipient_email, request_id, expires_at)
    VALUES (v_code, v_owner, NULL, p_request_id, now() + interval '7 days') RETURNING * INTO v_invite;
  -- Issuer, creation, expiry, eventual recipient and consumption are retained for audit.
  RETURN json_build_object('code', v_invite.code, 'expires_at', v_invite.expires_at);
END $$;
REVOKE ALL ON FUNCTION public.issue_shareable_user_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_shareable_user_invitation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_user_invitation_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_code text; v_invite public.user_invitations%ROWTYPE; v_ref text;
BEGIN
  v_code := upper(trim(coalesce(nullif(NEW.raw_user_meta_data->>'access_code', ''), NEW.raw_user_meta_data->>'ref', '')));
  SELECT * INTO v_invite FROM public.user_invitations WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    IF coalesce((public.validate_legacy_mvp_access_code(v_code)->>'valid')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'YAMILOOK_MVP_ONLY: é necessário um convite autorizado';
    END IF;
    RETURN NEW;
  END IF;
  IF NOT public.can_issue_user_invitation(v_invite.invited_by) THEN
    RAISE EXCEPTION 'Este convite já não está autorizado';
  END IF;
  IF v_invite.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este convite já foi utilizado'; END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN RAISE EXCEPTION 'Este convite expirou'; END IF;
  IF nullif(trim(NEW.email), '') IS NULL THEN RAISE EXCEPTION 'Email obrigatório'; END IF;
  IF v_invite.recipient_email IS NOT NULL AND lower(trim(NEW.email)) IS DISTINCT FROM v_invite.recipient_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro email';
  END IF;
  SELECT referral_code INTO v_ref FROM public.profiles WHERE id = v_invite.invited_by;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
  UPDATE public.user_invitations SET used_at = now(), used_by = NEW.id,
    recipient_email = coalesce(recipient_email, lower(trim(NEW.email))) WHERE code = v_code;
  -- Retain the original token for audit and pass the verified inviter to the existing gate.
  NEW.raw_user_meta_data := coalesce(NEW.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('invitation_code', v_code, 'access_code', v_ref, 'ref', v_ref);
  RETURN NEW;
END $function$;


CREATE OR REPLACE FUNCTION public.validate_mvp_access_code(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.user_invitations%ROWTYPE;
BEGIN
 SELECT * INTO v_invite FROM public.user_invitations WHERE code = upper(trim(p_code));
 IF FOUND THEN
   IF v_invite.used_at IS NOT NULL THEN RETURN json_build_object('valid', false, 'error', 'Este convite já foi utilizado'); END IF;
   IF NOT public.can_issue_user_invitation(v_invite.invited_by) THEN
     RETURN json_build_object('valid', false, 'error', 'Este convite já não está autorizado');
   END IF;
   IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
     RETURN json_build_object('valid', false, 'error', 'Este convite expirou');
   END IF;
   RETURN json_build_object('valid', true, 'single_use', true);
 END IF;
 RETURN public.validate_legacy_mvp_access_code(p_code);
END $$;

-- Preserve explicit ACLs when replacing privileged entry points.
REVOKE ALL ON FUNCTION public.consume_user_invitation_on_signup() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_mvp_access_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_mvp_access_code(text) TO anon, authenticated;
COMMIT;
