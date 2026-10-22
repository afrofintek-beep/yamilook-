-- MVP invitation delegation is separate from administrator/moderator roles.
CREATE TABLE public.invitation_permissions (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 granted_by uuid NOT NULL REFERENCES public.profiles(id),
 granted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invitation_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own or admin invitation permissions" ON public.invitation_permissions
 FOR SELECT TO authenticated USING (user_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'));
REVOKE ALL ON public.invitation_permissions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.invitation_permissions TO authenticated;
CREATE FUNCTION public.can_issue_user_invitation(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT p_user_id IS NOT NULL AND (
 public.has_role(p_user_id, 'admin') OR EXISTS (SELECT 1 FROM public.invitation_permissions WHERE user_id = p_user_id));
$$;
REVOKE ALL ON FUNCTION public.can_issue_user_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_issue_user_invitation(uuid) TO authenticated;
CREATE FUNCTION public.set_invitation_permission(p_email text, p_allowed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
   RAISE EXCEPTION 'Só o administrador pode gerir autorizações.' USING ERRCODE = '42501';
 END IF;
 SELECT id INTO v_user FROM public.profiles WHERE lower(trim(email)) = lower(trim(p_email));
 IF v_user IS NULL THEN RAISE EXCEPTION 'Este email ainda não tem uma conta Yamilook.'; END IF;
 IF public.has_role(v_user, 'admin') THEN RAISE EXCEPTION 'O administrador já tem esta permissão.'; END IF;
 IF p_allowed THEN
   INSERT INTO public.invitation_permissions(user_id, granted_by) VALUES (v_user, auth.uid())
   ON CONFLICT (user_id) DO UPDATE SET granted_by = auth.uid(), granted_at = now();
 ELSE
   DELETE FROM public.invitation_permissions WHERE user_id = v_user;
 END IF;
END $$;
CREATE FUNCTION public.list_invitation_permissions()
RETURNS TABLE(email text, granted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
   RAISE EXCEPTION 'Só o administrador pode gerir autorizações.' USING ERRCODE = '42501';
 END IF;
 RETURN QUERY SELECT p.email, ip.granted_at FROM public.invitation_permissions ip
 JOIN public.profiles p ON p.id = ip.user_id ORDER BY ip.granted_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.set_invitation_permission(text,boolean), public.list_invitation_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_invitation_permission(text,boolean), public.list_invitation_permissions() TO authenticated;
CREATE OR REPLACE FUNCTION public.issue_user_invitation(p_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_email text := lower(trim(p_email)); v_code text; v_owner uuid := auth.uid();
BEGIN
  IF NOT public.can_issue_user_invitation(v_owner) THEN RAISE EXCEPTION 'Só o administrador ou uma pessoa autorizada pode enviar convites no MVP.' USING ERRCODE = '42501'; END IF;
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
END $function$;

CREATE OR REPLACE FUNCTION public.validate_legacy_mvp_access_code(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_candidate RECORD; v_member RECORD;
BEGIN
  -- código de convite de um membro (multi-uso)
  SELECT id, display_name INTO v_member FROM public.profiles
   WHERE upper(referral_code) = upper(trim(p_code)) AND public.can_issue_user_invitation(id) LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('valid', true, 'referral', true, 'member_name', v_member.display_name);
  END IF;

  -- código MVP clássico (uso único, emitido por admin)
  SELECT * INTO v_candidate FROM public.mvp_candidates WHERE access_code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Código inválido');
  END IF;
  IF v_candidate.status != 'approved' THEN
    RETURN json_build_object('valid', false, 'error', 'Código não está ativo');
  END IF;
  IF v_candidate.code_used THEN
    RETURN json_build_object('valid', false, 'error', 'Este código já foi utilizado');
  END IF;
  RETURN json_build_object('valid', true, 'candidate_id', v_candidate.id,
    'full_name', v_candidate.full_name, 'email', v_candidate.email);
END $function$;

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
END $function$;

-- Pending invitations are also rejected when the issuer's authorization is removed.
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
   RETURN json_build_object('valid', true, 'single_use', true);
 END IF;
 RETURN public.validate_legacy_mvp_access_code(p_code);
END $$;

