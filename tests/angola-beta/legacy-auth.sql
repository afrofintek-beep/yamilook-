CREATE OR REPLACE FUNCTION public.consume_user_invitation_on_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_code text; v_invite public.user_invitations%ROWTYPE; v_ref text; v_campaign uuid;
BEGIN
  v_code := upper(trim(coalesce(nullif(NEW.raw_user_meta_data->>'access_code', ''), NEW.raw_user_meta_data->>'ref', '')));
  v_ref := private.consume_registration_link(v_code, NEW.id, NEW.email);
  IF v_ref IS NOT NULL THEN
    NEW.raw_user_meta_data := coalesce(NEW.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('invitation_code',v_code,'access_code',v_ref,'ref',v_ref);
    RETURN NEW;
  END IF;
  -- Same lock order as issuance and administrative suspension: campaign, then token.
  SELECT campaign_id INTO v_campaign FROM public.user_invitations WHERE code=v_code;
  IF v_campaign IS NOT NULL THEN
    PERFORM 1 FROM public.invitation_campaigns WHERE id=v_campaign FOR UPDATE;
  END IF;
  SELECT * INTO v_invite FROM public.user_invitations WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    IF coalesce((public.validate_legacy_mvp_access_code(v_code)->>'valid')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'YAMILOOK_MVP_ONLY: é necessário um convite autorizado';
    END IF;
    RETURN NEW;
  END IF;
  IF (v_invite.campaign_id IS NULL AND NOT public.can_issue_user_invitation(v_invite.invited_by))
    OR (v_invite.campaign_id IS NOT NULL AND NOT private.campaign_token_authorized(v_invite.campaign_id,v_invite.invited_by)) THEN
    RAISE EXCEPTION 'Este convite já não está autorizado';
  END IF;
  IF v_invite.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este convite já foi utilizado'; END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= clock_timestamp() THEN RAISE EXCEPTION 'Este convite expirou'; END IF;
  IF nullif(trim(NEW.email), '') IS NULL THEN RAISE EXCEPTION 'Email obrigatório'; END IF;
  IF v_invite.recipient_email IS NOT NULL AND lower(trim(NEW.email)) IS DISTINCT FROM v_invite.recipient_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro email';
  END IF;
  SELECT referral_code INTO v_ref FROM public.profiles WHERE id = v_invite.invited_by;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
  UPDATE public.user_invitations SET used_at = clock_timestamp(), used_by = NEW.id,
    recipient_email = coalesce(recipient_email, lower(trim(NEW.email))) WHERE code = v_code;
  IF v_invite.campaign_id IS NOT NULL THEN
    INSERT INTO public.invitation_campaign_audit(campaign_id,actor_id,action,details)
    VALUES(v_invite.campaign_id,v_invite.invited_by,'invitation_used',jsonb_build_object('code',v_code,'used_by',NEW.id));
  END IF;
  -- Retain the original token for audit and pass the verified inviter to the existing gate.
  NEW.raw_user_meta_data := coalesce(NEW.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('invitation_code', v_code, 'access_code', v_ref, 'ref', v_ref);
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ref text; v_access text; v_referrer uuid; v_ok boolean := false;
BEGIN
  v_ref := trim(coalesce(NEW.raw_user_meta_data->>'ref', ''));
  v_access := trim(coalesce(NEW.raw_user_meta_data->>'access_code', ''));

  -- (a) código de convite via link ?ref=
  IF v_ref <> '' THEN
    SELECT id INTO v_referrer FROM public.profiles
     WHERE upper(referral_code) = upper(v_ref) AND id <> NEW.id LIMIT 1;
    IF v_referrer IS NOT NULL THEN v_ok := true; END IF;
  END IF;

  -- (b) código digitado no formulário: convite de membro OU código MVP aprovado
  IF NOT v_ok AND v_access <> '' THEN
    SELECT id INTO v_referrer FROM public.profiles
     WHERE upper(referral_code) = upper(v_access) AND id <> NEW.id LIMIT 1;
    IF v_referrer IS NOT NULL THEN
      v_ok := true;
    ELSIF EXISTS (
      SELECT 1 FROM public.mvp_candidates
       WHERE access_code = upper(v_access) AND status = 'approved' AND code_used = false
    ) THEN
      v_ok := true;
    END IF;
  END IF;

  -- (c) contas de teste internas continuam a funcionar
  IF NOT v_ok AND NEW.email LIKE '%@yamilook.test' THEN v_ok := true; END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'YAMILOOK_MVP_ONLY: inscrição por convite; lançamento público brevemente';
  END IF;

  INSERT INTO public.profiles (id, email, display_name, username, referred_by)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    v_referrer
  );

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);

  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.validate_mvp_access_code(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_invite public.user_invitations%ROWTYPE; v_shared json;
BEGIN
 v_shared:=private.validate_registration_link(p_code);
 IF v_shared IS NOT NULL THEN RETURN v_shared; END IF;
 SELECT * INTO v_invite FROM public.user_invitations WHERE code = upper(trim(p_code));
 IF FOUND THEN
   IF v_invite.used_at IS NOT NULL THEN RETURN json_build_object('valid', false, 'error', 'Este convite já foi utilizado'); END IF;
   IF (v_invite.campaign_id IS NULL AND NOT public.can_issue_user_invitation(v_invite.invited_by))
    OR (v_invite.campaign_id IS NOT NULL AND NOT private.campaign_token_authorized(v_invite.campaign_id,v_invite.invited_by)) THEN
     RETURN json_build_object('valid', false, 'error', 'Este convite já não está autorizado');
   END IF;
   IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= clock_timestamp() THEN
     RETURN json_build_object('valid', false, 'error', 'Este convite expirou');
   END IF;
   RETURN json_build_object('valid', true, 'single_use', true);
 END IF;
 RETURN public.validate_legacy_mvp_access_code(p_code);
END $function$;

