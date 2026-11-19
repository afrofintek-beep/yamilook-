BEGIN;
ALTER TABLE public.user_invitations
 ADD COLUMN confirmation_policy text NOT NULL DEFAULT 'email'
 CHECK (confirmation_policy IN ('email','admin_waiver')),
 ADD COLUMN waiver_authorized_at timestamptz,
 ADD CONSTRAINT invitation_waiver_bound CHECK (
 confirmation_policy = 'email' OR
 (recipient_email IS NOT NULL AND expires_at IS NOT NULL AND waiver_authorized_at IS NOT NULL AND campaign_id IS NULL));

CREATE TABLE public.individual_invitation_authorizations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code text NOT NULL REFERENCES public.user_invitations(code),
 authorized_by uuid NOT NULL REFERENCES auth.users(id),
 confirmation_policy text NOT NULL CHECK (confirmation_policy IN ('email','admin_waiver')),
 authorized_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.individual_invitation_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.individual_invitation_authorizations FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.individual_invitation_authorizations TO authenticated;
CREATE POLICY admin_read_invitation_authorizations ON public.individual_invitation_authorizations
 FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.issue_individual_invitation(p_email text, p_policy text DEFAULT 'email')
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result json; token text;
BEGIN
 PERFORM private.invitation_require_admin();
 IF p_policy NOT IN ('email','admin_waiver') OR p_policy IS NULL THEN
   RAISE EXCEPTION 'Tipo de convite inválido';
 END IF;
 result := public.issue_user_invitation(p_email);
 token := result->>'code';
 UPDATE public.user_invitations
 SET confirmation_policy=p_policy,
     waiver_authorized_at=CASE WHEN p_policy='admin_waiver' THEN clock_timestamp() END,
     expires_at=clock_timestamp()+interval '7 days'
 WHERE code=token AND invited_by=auth.uid() AND used_at IS NULL;
 INSERT INTO public.individual_invitation_authorizations(code,authorized_by,confirmation_policy)
 VALUES(token,auth.uid(),p_policy);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.issue_individual_invitation(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.issue_individual_invitation(text,text) TO authenticated;

-- The row is already locked and consumed by consume_user_invitation_before_signup.
-- Authority comes from the stored invitation and server-owned app metadata.
CREATE FUNCTION public.check_known_contact_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE invitation public.user_invitations%ROWTYPE;
BEGIN
 SELECT * INTO invitation FROM public.user_invitations WHERE used_by=NEW.id;
 IF NEW.raw_app_meta_data->>'known_contact_registration'='true' THEN
   IF invitation.code IS NULL OR invitation.confirmation_policy<>'admin_waiver' THEN
     RAISE EXCEPTION 'Este convite exige confirmação por email';
   END IF;
   IF NOT public.has_role(invitation.invited_by,'admin') THEN
     RAISE EXCEPTION 'Este convite já não está autorizado';
   END IF;
   IF NEW.email_confirmed_at IS NOT NULL THEN
     NEW.raw_app_meta_data := (coalesce(NEW.raw_app_meta_data,'{}'::jsonb) - 'known_contact_registration') ||
       jsonb_build_object('email_confirmation_method','admin_waiver',
         'invitation_authorized_by',invitation.invited_by,
         'invitation_authorized_at',invitation.waiver_authorized_at);
   END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.check_known_contact_signup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER known_contact_signup_after_invitation BEFORE INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.check_known_contact_signup();
CREATE FUNCTION public.invitation_confirmation_policy(p_code text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT confirmation_policy FROM public.user_invitations
 WHERE code=upper(trim(p_code))),'email');
$$;
REVOKE ALL ON FUNCTION public.invitation_confirmation_policy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_confirmation_policy(text) TO anon,authenticated;
COMMIT;
