-- Shared registration links are a separate, bounded administrator channel.
-- No links or accounts are created by this migration.
CREATE TABLE private.registration_links (
 id uuid PRIMARY KEY,
 code text UNIQUE NOT NULL CHECK (code ~ '^[A-F0-9]{16}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 160),
 created_by uuid NOT NULL REFERENCES auth.users(id),
 max_uses integer NOT NULL CHECK (max_uses BETWEEN 1 AND 100000),
 uses_count integer NOT NULL DEFAULT 0 CHECK (uses_count BETWEEN 0 AND max_uses),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CHECK (expires_at > created_at)
);
CREATE TABLE private.registration_link_redemptions (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 link_id uuid NOT NULL REFERENCES private.registration_links(id),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX registration_link_redemptions_link_idx ON private.registration_link_redemptions(link_id);
CREATE TABLE private.registration_link_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 link_id uuid NOT NULL REFERENCES private.registration_links(id),
 actor_id uuid,
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.registration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.registration_link_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.registration_link_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.registration_links,private.registration_link_redemptions,private.registration_link_audit FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.create_registration_link(p_request_id uuid,p_name text,p_max_uses integer,p_ttl_hours integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v private.registration_links%ROWTYPE; v_code text; v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'Só o administrador pode gerir convites.' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL OR nullif(trim(p_name),'') IS NULL OR length(trim(p_name))>160
  OR p_max_uses IS NULL OR p_max_uses NOT BETWEEN 1 AND 100000
  OR p_ttl_hours IS NULL OR p_ttl_hours NOT BETWEEN 1 AND 168 THEN RAISE EXCEPTION 'Configuração de convite inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('registration-link:'||p_request_id::text,0));
 SELECT * INTO v FROM private.registration_links WHERE id=p_request_id;
 IF FOUND THEN
  IF v.created_by<>v_actor OR v.name<>trim(p_name) OR v.max_uses<>p_max_uses
   OR v.expires_at-v.created_at<>make_interval(hours=>p_ttl_hours) THEN RAISE EXCEPTION 'Pedido de convite já utilizado'; END IF;
  RETURN to_jsonb(v);
 END IF;
 LOOP
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM private.registration_links WHERE code=v_code)
   AND NOT EXISTS(SELECT 1 FROM public.user_invitations WHERE code=v_code)
   AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE upper(referral_code)=v_code)
   AND NOT EXISTS(SELECT 1 FROM public.mvp_candidates WHERE upper(access_code)=v_code);
 END LOOP;
 INSERT INTO private.registration_links(id,code,name,created_by,max_uses,created_at,expires_at)
 VALUES(p_request_id,v_code,trim(p_name),v_actor,p_max_uses,statement_timestamp(),statement_timestamp()+make_interval(hours=>p_ttl_hours))
 RETURNING * INTO v;
 INSERT INTO private.registration_link_audit(link_id,actor_id,action) VALUES(v.id,v_actor,'created');
 RETURN to_jsonb(v);
END $$;

CREATE FUNCTION private.admin_registration_links(p_link uuid DEFAULT NULL,p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_actor uuid:=auth.uid(); result jsonb;
BEGIN
 IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'Só o administrador pode gerir convites.' USING ERRCODE='42501'; END IF;
 IF p_status IS NOT NULL THEN
  IF p_link IS NULL OR p_status NOT IN ('active','suspended') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  UPDATE private.registration_links SET status=p_status WHERE id=p_link;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite não encontrado'; END IF;
  INSERT INTO private.registration_link_audit(link_id,actor_id,action) VALUES(p_link,v_actor,p_status);
 END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM (
  SELECT l.*, (SELECT count(*) FROM private.registration_link_redemptions r JOIN auth.users u ON u.id=r.user_id
    WHERE r.link_id=l.id AND u.email_confirmed_at IS NOT NULL) AS confirmed_count,
    greatest(0,l.max_uses-l.uses_count) AS remaining
  FROM private.registration_links l ORDER BY l.created_at DESC LIMIT 100
 ) x;
 RETURN result;
END $$;

-- Returns NULL for other invitation types. Only the existing signup trigger can consume.
CREATE FUNCTION private.consume_registration_link(p_code text,p_user uuid,p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v private.registration_links%ROWTYPE; v_ref text;
BEGIN
 SELECT * INTO v FROM private.registration_links WHERE code=p_code FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v.status<>'active' OR NOT public.has_role(v.created_by,'admin') THEN RAISE EXCEPTION 'Este convite já não está autorizado'; END IF;
 IF v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Este convite expirou'; END IF;
 IF v.uses_count>=v.max_uses THEN RAISE EXCEPTION 'Este convite atingiu o limite de inscrições'; END IF;
 IF nullif(trim(p_email),'') IS NULL THEN RAISE EXCEPTION 'Email obrigatório'; END IF;
 SELECT referral_code INTO v_ref FROM public.profiles WHERE id=v.created_by;
 IF v_ref IS NULL THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
 UPDATE private.registration_links SET uses_count=uses_count+1 WHERE id=v.id;
 INSERT INTO private.registration_link_redemptions(user_id,link_id) VALUES(p_user,v.id);
 INSERT INTO private.registration_link_audit(link_id,actor_id,action) VALUES(v.id,p_user,'registered');
 RETURN v_ref;
END $$;

-- Public validation deliberately returns no owner, email, code list or recipient data.
CREATE FUNCTION private.validate_registration_link(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v private.registration_links%ROWTYPE;
BEGIN
 SELECT * INTO v FROM private.registration_links WHERE code=upper(trim(p_code));
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v.status<>'active' OR NOT public.has_role(v.created_by,'admin') THEN
  RETURN json_build_object('valid',false,'error','Este convite já não está autorizado');
 END IF;
 IF v.expires_at<=clock_timestamp() THEN RETURN json_build_object('valid',false,'error','Este convite expirou'); END IF;
 IF v.uses_count>=v.max_uses THEN RETURN json_build_object('valid',false,'error','Este convite atingiu o limite de inscrições'); END IF;
 RETURN json_build_object('valid',true,'multi_use',true,'remaining',v.max_uses-v.uses_count,'expires_at',v.expires_at);
END $$;

CREATE FUNCTION public.create_registration_link(p_request_id uuid,p_name text,p_max_uses integer,p_ttl_hours integer)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.create_registration_link(p_request_id,p_name,p_max_uses,p_ttl_hours) $$;
CREATE FUNCTION public.admin_registration_links(p_link uuid DEFAULT NULL,p_status text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $$ SELECT private.admin_registration_links(p_link,p_status) $$;
REVOKE ALL ON FUNCTION private.create_registration_link(uuid,text,integer,integer),private.admin_registration_links(uuid,text),
 private.consume_registration_link(text,uuid,text),private.validate_registration_link(text),
 public.create_registration_link(uuid,text,integer,integer),public.admin_registration_links(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_registration_link(uuid,text,integer,integer),private.admin_registration_links(uuid,text),
 public.create_registration_link(uuid,text,integer,integer),public.admin_registration_links(uuid,text) TO authenticated;

-- Preserve the individual, controlled-campaign and legacy invitation paths.
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
END $function$
;
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
END $function$
;
