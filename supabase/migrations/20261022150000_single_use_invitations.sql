-- Single-use, email-bound invitations. Existing member codes remain compatible.
BEGIN;
CREATE TABLE public.user_invitations (
  code text PRIMARY KEY CHECK (code ~ '^[A-F0-9]{16}$'),
  invited_by uuid NOT NULL REFERENCES public.profiles(id),
  recipient_email text NOT NULL CHECK (recipient_email = lower(trim(recipient_email))),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id) DEFERRABLE INITIALLY DEFERRED,
  CHECK ((used_at IS NULL) = (used_by IS NULL))
);
CREATE UNIQUE INDEX user_invitations_pending_recipient
  ON public.user_invitations(invited_by, recipient_email) WHERE used_at IS NULL;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own invitations" ON public.user_invitations
  FOR SELECT TO authenticated USING (invited_by = auth.uid());
REVOKE ALL ON public.user_invitations FROM anon, authenticated;
GRANT SELECT ON public.user_invitations TO authenticated;

CREATE FUNCTION public.issue_user_invitation(p_email text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(trim(p_email)); v_code text; v_owner uuid := auth.uid();
BEGIN
  IF v_owner IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'Este email já tem conta. Usa a opção de entrar.';
  END IF;
  -- Serialize creation for the same inviter/recipient pair, including concurrent clicks.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_owner::text || ':' || v_email, 0));
  SELECT code INTO v_code FROM public.user_invitations
    WHERE invited_by = v_owner AND recipient_email = v_email AND used_at IS NULL;
  IF NOT FOUND THEN
    LOOP
      v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_invitations WHERE code = v_code)
        AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(referral_code) = v_code)
        AND NOT EXISTS (SELECT 1 FROM public.mvp_candidates WHERE upper(access_code) = v_code);
    END LOOP;
    INSERT INTO public.user_invitations(code, invited_by, recipient_email)
      VALUES (v_code, v_owner, v_email);
  END IF;
  RETURN json_build_object('code', v_code);
END $$;
REVOKE ALL ON FUNCTION public.issue_user_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_user_invitation(text) TO authenticated;

-- Preserve the deployed legacy validator rather than replacing its implementation.
ALTER FUNCTION public.validate_mvp_access_code(text) RENAME TO validate_legacy_mvp_access_code;
REVOKE ALL ON FUNCTION public.validate_legacy_mvp_access_code(text) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.validate_mvp_access_code(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.user_invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.user_invitations WHERE code = upper(trim(p_code));
  IF FOUND THEN
    IF v_invite.used_at IS NOT NULL THEN
      RETURN json_build_object('valid', false, 'error', 'Este convite já foi utilizado');
    END IF;
    RETURN json_build_object('valid', true, 'single_use', true);
  END IF;
  RETURN public.validate_legacy_mvp_access_code(p_code);
END $$;
REVOKE ALL ON FUNCTION public.validate_mvp_access_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_mvp_access_code(text) TO anon, authenticated;

-- Consume inside the auth-user transaction, before the existing profile gate.
-- A failed signup rolls back consumption; row locks prevent two accounts reusing it.
CREATE FUNCTION public.consume_user_invitation_on_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_code text; v_invite public.user_invitations%ROWTYPE; v_ref text;
BEGIN
  v_code := upper(trim(coalesce(nullif(NEW.raw_user_meta_data->>'access_code', ''), NEW.raw_user_meta_data->>'ref', '')));
  SELECT * INTO v_invite FROM public.user_invitations WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF v_invite.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este convite já foi utilizado'; END IF;
  IF lower(trim(NEW.email)) IS DISTINCT FROM v_invite.recipient_email THEN
    RAISE EXCEPTION 'Este convite pertence a outro email';
  END IF;
  SELECT referral_code INTO v_ref FROM public.profiles WHERE id = v_invite.invited_by;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
  UPDATE public.user_invitations SET used_at = now(), used_by = NEW.id WHERE code = v_code;
  -- Retain the original token for audit and pass the verified inviter to the existing gate.
  NEW.raw_user_meta_data := coalesce(NEW.raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('invitation_code', v_code, 'access_code', v_ref, 'ref', v_ref);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.consume_user_invitation_on_signup() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER consume_user_invitation_before_signup BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.consume_user_invitation_on_signup();
COMMIT;
