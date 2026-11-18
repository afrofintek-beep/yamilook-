-- A named campaign has exactly one promoter and ten single-use invitations.
ALTER TABLE public.invitation_campaigns
  ADD COLUMN promoter_id uuid REFERENCES public.profiles(id),
  ADD CONSTRAINT promoter_campaign_quota CHECK (promoter_id IS NULL OR (max_per_user = 10 AND max_total = 10 AND require_confirmed_email));
CREATE INDEX invitation_campaigns_promoter ON public.invitation_campaigns(promoter_id) WHERE promoter_id IS NOT NULL;

CREATE FUNCTION private.create_promoter_campaign(p_config jsonb, p_email text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE promoter uuid; campaign uuid;
BEGIN
  PERFORM private.invitation_require_admin();
  SELECT u.id INTO STRICT promoter FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE lower(u.email) = lower(trim(p_email)) AND u.deleted_at IS NULL;
  campaign := private.save_invitation_campaign(NULL, p_config || '{"max_per_user":10,"max_total":10,"status":"draft","require_confirmed_email":true}'::jsonb);
  UPDATE public.invitation_campaigns SET promoter_id = promoter WHERE id = campaign;
  INSERT INTO public.invitation_campaign_audit(campaign_id, actor_id, action, details)
    VALUES (campaign, auth.uid(), 'promoter_assigned', jsonb_build_object('promoter_id', promoter));
  RETURN campaign;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Conta não encontrada.';
END $$;

CREATE FUNCTION public.create_promoter_campaign(p_config jsonb, p_email text) RETURNS uuid
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.create_promoter_campaign(p_config,p_email) $$;

CREATE FUNCTION private.check_campaign_promoter() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.invitation_campaigns WHERE id = NEW.campaign_id AND promoter_id <> NEW.user_id) THEN
    RAISE EXCEPTION 'Só o promotor desta campanha pode emitir convites.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER check_campaign_promoter BEFORE INSERT OR UPDATE OF campaign_id,user_id ON public.invitation_campaign_members
  FOR EACH ROW EXECUTE FUNCTION private.check_campaign_promoter();

CREATE FUNCTION private.issue_promoter_invitations(p_campaign uuid, p_name text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE c public.invitation_campaigns; issued integer; title text := trim(p_name);
BEGIN
  SELECT * INTO c FROM public.invitation_campaigns WHERE id = p_campaign FOR UPDATE;
  IF auth.uid() IS NULL OR c.promoter_id IS NULL OR c.promoter_id <> auth.uid()
     OR NOT private.invitation_campaign_eligible(p_campaign,auth.uid())
     OR c.status <> 'active' OR clock_timestamp() < c.starts_at OR clock_timestamp() >= c.ends_at THEN
    RAISE EXCEPTION 'Sem autorização ou elegibilidade para esta campanha.' USING ERRCODE = '42501';
  END IF;
  IF title IS NULL OR length(title) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome de campanha inválido.'; END IF;
  SELECT count(*) INTO issued FROM public.user_invitations WHERE campaign_id = c.id;
  IF title <> c.name THEN
    IF issued > 0 THEN RAISE EXCEPTION 'Já existem convites emitidos com outro nome.'; END IF;
    UPDATE public.invitation_campaigns SET name = title WHERE id = c.id;
    INSERT INTO public.invitation_campaign_audit(campaign_id, actor_id, action, details)
      VALUES (c.id, auth.uid(), 'promoter_campaign_named', jsonb_build_object('name',title));
  END IF;
  -- One transaction and the existing issuer checks, rate limit, audit and redemption path.
  -- A retry after a lost response recovers the existing ten, including their current states.
  FOR slot IN (issued + 1)..10 LOOP
    PERFORM private.issue_campaign_invitation(c.id,gen_random_uuid(),NULL);
  END LOOP;
  RETURN private.campaign_report(c.id,0);
END $$;

CREATE FUNCTION public.issue_promoter_invitations(p_campaign uuid, p_name text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$ SELECT private.issue_promoter_invitations(p_campaign,p_name) $$;

REVOKE ALL ON FUNCTION private.check_campaign_promoter(), private.create_promoter_campaign(jsonb,text),
  public.create_promoter_campaign(jsonb,text), private.issue_promoter_invitations(uuid,text),
  public.issue_promoter_invitations(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.create_promoter_campaign(jsonb,text),public.create_promoter_campaign(jsonb,text),
  private.issue_promoter_invitations(uuid,text),public.issue_promoter_invitations(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.list_invitation_campaigns() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE admin boolean:=public.has_role(auth.uid(),'admin'); result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM (
  SELECT c.*,private.invitation_campaign_eligible(c.id,auth.uid()) AS eligible,
   (SELECT count(*) FROM public.user_invitations i WHERE i.campaign_id=c.id AND i.invited_by=auth.uid()) AS my_issued,
   (SELECT count(*) FROM public.user_invitations i WHERE i.campaign_id=c.id) AS total_issued
  FROM public.invitation_campaigns c WHERE admin OR c.promoter_id=auth.uid() OR EXISTS(SELECT 1 FROM public.invitation_campaign_members m
   WHERE m.campaign_id=c.id AND m.user_id=auth.uid()) ORDER BY c.created_at DESC LIMIT 100
 ) x;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION private.campaign_report(p_campaign uuid,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE admin boolean:=public.has_role(auth.uid(),'admin'); result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Página inválida.'; END IF;
 IF NOT admin AND NOT EXISTS(SELECT 1 FROM public.invitation_campaigns WHERE id=p_campaign AND promoter_id=auth.uid())
  AND NOT EXISTS(SELECT 1 FROM public.invitation_campaign_members WHERE campaign_id=p_campaign AND user_id=auth.uid()) THEN
  RAISE EXCEPTION 'Sem acesso.' USING ERRCODE='42501';
 END IF;
 SELECT jsonb_build_object('issued',count(*),'used',count(*) FILTER(WHERE used_at IS NOT NULL),
  'expired',count(*) FILTER(WHERE used_at IS NULL AND expires_at<=clock_timestamp()),
  'pending',count(*) FILTER(WHERE used_at IS NULL AND expires_at>clock_timestamp())) INTO result
 FROM public.user_invitations WHERE campaign_id=p_campaign AND (admin OR invited_by=auth.uid());
 result:=result||jsonb_build_object('invitations',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
  SELECT i.code,i.invited_by,i.recipient_email,i.created_at,i.expires_at,i.used_at,
   CASE WHEN i.used_at IS NOT NULL THEN 'used' WHEN i.expires_at<=clock_timestamp() THEN 'expired' ELSE 'pending' END AS state
  FROM public.user_invitations i WHERE i.campaign_id=p_campaign AND (admin OR i.invited_by=auth.uid())
  ORDER BY i.created_at DESC,i.code LIMIT 50 OFFSET p_offset) x),'[]'::jsonb));
 IF admin THEN
  result:=result||jsonb_build_object('members',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (
   SELECT m.*,u.email,private.invitation_campaign_eligible(p_campaign,m.user_id) AS eligible
   FROM public.invitation_campaign_members m JOIN auth.users u ON u.id=m.user_id WHERE m.campaign_id=p_campaign
   ORDER BY m.approved_at DESC,m.user_id LIMIT 50 OFFSET p_offset) x),'[]'::jsonb),
   'audit',coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.invitation_campaign_audit
    WHERE campaign_id=p_campaign ORDER BY id DESC LIMIT 50 OFFSET p_offset) x),'[]'::jsonb));
 END IF;
 RETURN result;
END $$;

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
   IF v_invite.campaign_id IS NOT NULL THEN
     SELECT json_build_object('valid',true,'single_use',true,'campaign_name',c.name) INTO v_shared
       FROM public.invitation_campaigns c WHERE c.id=v_invite.campaign_id AND c.promoter_id=v_invite.invited_by;
     IF FOUND THEN RETURN v_shared; END IF;
   END IF;
   RETURN json_build_object('valid', true, 'single_use', true);
 END IF;
 RETURN public.validate_legacy_mvp_access_code(p_code);
END $function$
;
