-- Proposed only: no campaign, participant or entitlement is seeded.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE public.invitation_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
 revision bigint NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','closed')),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK (ends_at > starts_at),
 max_per_user integer NOT NULL CHECK (max_per_user BETWEEN 1 AND 10),
 max_total integer NOT NULL CHECK (max_total BETWEEN 1 AND 100000),
 active_within_days integer NOT NULL CHECK (active_within_days BETWEEN 1 AND 90),
 min_account_days integer NOT NULL CHECK (min_account_days BETWEEN 0 AND 3650),
 require_confirmed_email boolean NOT NULL DEFAULT true,
 invite_ttl_hours integer NOT NULL CHECK (invite_ttl_hours BETWEEN 1 AND 168),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid NOT NULL REFERENCES public.profiles(id)
);
CREATE TABLE public.invitation_campaign_members (
 campaign_id uuid NOT NULL REFERENCES public.invitation_campaigns(id),
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 approved_by uuid NOT NULL REFERENCES public.profiles(id),
 approved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 presence_valid_until timestamptz NOT NULL,
 verification_reference text NOT NULL CHECK (length(trim(verification_reference)) BETWEEN 8 AND 500),
 revoked_at timestamptz,
 PRIMARY KEY(campaign_id,user_id)
);
CREATE INDEX invitation_campaign_members_user ON public.invitation_campaign_members(user_id,campaign_id);
CREATE TABLE public.invitation_campaign_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 campaign_id uuid NOT NULL REFERENCES public.invitation_campaigns(id),
 actor_id uuid REFERENCES public.profiles(id),
 action text NOT NULL,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX invitation_campaign_audit_campaign ON public.invitation_campaign_audit(campaign_id,id DESC);
ALTER TABLE public.user_invitations ADD COLUMN campaign_id uuid REFERENCES public.invitation_campaigns(id);
ALTER TABLE public.user_invitations ADD CONSTRAINT campaign_invitation_expiry CHECK
 (campaign_id IS NULL OR (expires_at IS NOT NULL AND request_id IS NOT NULL));
CREATE INDEX invitation_campaign_issued ON public.user_invitations(campaign_id,invited_by);
CREATE INDEX invitation_issuer_recent ON public.user_invitations(invited_by,created_at);
CREATE INDEX invitation_recipient_pending ON public.user_invitations(recipient_email) WHERE used_at IS NULL;
-- Do not let expired campaign rows interfere with the legacy admin workflow.
DROP INDEX public.user_invitations_pending_recipient;
CREATE UNIQUE INDEX user_invitations_pending_recipient ON public.user_invitations(invited_by,recipient_email)
 WHERE used_at IS NULL AND campaign_id IS NULL;
-- A recipient cannot be reissued in the same campaign, including after expiry/use.
CREATE UNIQUE INDEX campaign_invitation_recipient ON public.user_invitations(campaign_id,recipient_email)
 WHERE campaign_id IS NOT NULL AND recipient_email IS NOT NULL;
ALTER TABLE public.invitation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_campaign_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invitation_campaigns,public.invitation_campaign_members,public.invitation_campaign_audit FROM PUBLIC,anon,authenticated;
-- Deliberately no direct writes or SELECT grants: bounded, caller-scoped RPCs below.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.user_invitations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.invitation_require_admin() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Só o administrador pode gerir campanhas.' USING ERRCODE='42501';
 END IF;
END $$;

CREATE FUNCTION private.invitation_campaign_eligible(p_campaign uuid,p_user uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (
  SELECT 1 FROM public.invitation_campaigns c
  JOIN public.invitation_campaign_members m ON m.campaign_id=c.id AND m.user_id=p_user
  JOIN auth.users u ON u.id=m.user_id
  WHERE c.id=p_campaign AND m.revoked_at IS NULL AND m.presence_valid_until>clock_timestamp()
   AND u.created_at<c.created_at -- Existing users only; no automatic invitation chains.
   AND u.created_at<=clock_timestamp()-make_interval(days=>c.min_account_days)
   AND u.last_sign_in_at>=clock_timestamp()-make_interval(days=>c.active_within_days)
   AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
   AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)
   AND (NOT c.require_confirmed_email OR u.email_confirmed_at IS NOT NULL)
 );
$$;

CREATE FUNCTION private.save_invitation_campaign(p_id uuid,p_config jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.invitation_campaigns; v_id uuid; v_status text:=p_config->>'status';
BEGIN
 PERFORM private.invitation_require_admin();
 IF p_id IS NULL THEN
  IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Cria primeiro um rascunho.'; END IF;
  INSERT INTO public.invitation_campaigns(name,starts_at,ends_at,max_per_user,max_total,active_within_days,
   min_account_days,require_confirmed_email,invite_ttl_hours,created_by)
  VALUES(trim(p_config->>'name'),(p_config->>'starts_at')::timestamptz,(p_config->>'ends_at')::timestamptz,
   (p_config->>'max_per_user')::integer,(p_config->>'max_total')::integer,(p_config->>'active_within_days')::integer,
   (p_config->>'min_account_days')::integer,(p_config->>'require_confirmed_email')::boolean,
   (p_config->>'invite_ttl_hours')::integer,auth.uid()) RETURNING id INTO v_id;
 ELSE
  SELECT * INTO c FROM public.invitation_campaigns WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha inexistente.'; END IF;
  IF c.status='closed' THEN RAISE EXCEPTION 'Campanha encerrada.'; END IF;
  IF v_status='draft' AND c.status<>'draft' THEN RAISE EXCEPTION 'Não é possível voltar a rascunho.'; END IF;
  IF v_status='active' AND (p_config->>'ends_at')::timestamptz<=clock_timestamp() THEN
   RAISE EXCEPTION 'Define uma data de fim futura.';
  END IF;
  IF (SELECT count(*) FROM public.user_invitations WHERE campaign_id=p_id)>(p_config->>'max_total')::integer
   OR EXISTS(SELECT 1 FROM public.user_invitations WHERE campaign_id=p_id GROUP BY invited_by
    HAVING count(*)>(p_config->>'max_per_user')::integer) THEN
   RAISE EXCEPTION 'O limite não pode ser inferior aos convites já emitidos.';
  END IF;
  UPDATE public.invitation_campaigns SET revision=revision+1,name=trim(p_config->>'name'),status=v_status,
   starts_at=(p_config->>'starts_at')::timestamptz,ends_at=(p_config->>'ends_at')::timestamptz,
   max_per_user=(p_config->>'max_per_user')::integer,max_total=(p_config->>'max_total')::integer,
   active_within_days=(p_config->>'active_within_days')::integer,min_account_days=(p_config->>'min_account_days')::integer,
   require_confirmed_email=(p_config->>'require_confirmed_email')::boolean,invite_ttl_hours=(p_config->>'invite_ttl_hours')::integer
  WHERE id=p_id RETURNING id INTO v_id;
  -- Shortening the campaign must also shorten outstanding token expiry. Extending
  -- the campaign never revives or extends a previously issued token.
  UPDATE public.user_invitations SET expires_at=(p_config->>'ends_at')::timestamptz
   WHERE campaign_id=p_id AND used_at IS NULL AND expires_at>(p_config->>'ends_at')::timestamptz;
 END IF;
 INSERT INTO public.invitation_campaign_audit(campaign_id,actor_id,action,details)
 VALUES(v_id,auth.uid(),'campaign_saved',jsonb_build_object('before',to_jsonb(c),'after',p_config));
 RETURN v_id;
END $$;

CREATE FUNCTION private.set_campaign_member(p_campaign uuid,p_email text,p_allowed boolean,p_reference text,p_valid_until timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.invitation_campaigns; u uuid; before_row jsonb;
BEGIN
 PERFORM private.invitation_require_admin();
 SELECT * INTO c FROM public.invitation_campaigns WHERE id=p_campaign FOR UPDATE;
 IF NOT FOUND OR c.status='closed' THEN RAISE EXCEPTION 'Campanha indisponível.'; END IF;
 SELECT id INTO u FROM auth.users WHERE lower(trim(email))=lower(trim(p_email)) AND deleted_at IS NULL;
 IF u IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=u) THEN RAISE EXCEPTION 'Conta não encontrada.'; END IF;
 SELECT to_jsonb(m) INTO before_row FROM public.invitation_campaign_members m WHERE campaign_id=p_campaign AND user_id=u;
 UPDATE public.invitation_campaigns SET revision=revision+1 WHERE id=p_campaign;
 IF p_allowed IS TRUE THEN
  IF p_valid_until IS NULL OR p_valid_until<=clock_timestamp() OR p_valid_until>c.ends_at THEN
   RAISE EXCEPTION 'A verificação deve ser válida e terminar até ao fim da campanha.';
  END IF;
  INSERT INTO public.invitation_campaign_members(campaign_id,user_id,approved_by,presence_valid_until,verification_reference)
  VALUES(p_campaign,u,auth.uid(),p_valid_until,trim(p_reference))
  ON CONFLICT(campaign_id,user_id) DO UPDATE SET approved_by=auth.uid(),approved_at=clock_timestamp(),
   presence_valid_until=excluded.presence_valid_until,verification_reference=excluded.verification_reference,revoked_at=NULL;
 ELSE
  UPDATE public.invitation_campaign_members SET revoked_at=clock_timestamp() WHERE campaign_id=p_campaign AND user_id=u;
 END IF;
 INSERT INTO public.invitation_campaign_audit(campaign_id,actor_id,action,details)
 VALUES(p_campaign,auth.uid(),CASE WHEN p_allowed THEN 'member_approved' ELSE 'member_revoked' END,
  jsonb_build_object('user_id',u,'before',before_row,'verification_reference',p_reference,'valid_until',p_valid_until));
END $$;

CREATE FUNCTION private.issue_campaign_invitation(p_campaign uuid,p_request_id uuid,p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.invitation_campaigns; i public.user_invitations; u uuid:=auth.uid();
 e text:=nullif(lower(trim(p_email)),''); n bigint; v_now timestamptz; v_code text;
BEGIN
 IF u IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'Pedido inválido.'; END IF;
 IF e IS NOT NULL AND (length(e)>254 OR e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION 'Email inválido.'; END IF;
 -- One transaction owns the campaign lock until its insert commits. This serializes
 -- per-user AND global quotas, edits, suspension and member revocation for this MVP.
 SELECT * INTO c FROM public.invitation_campaigns WHERE id=p_campaign FOR UPDATE;
 v_now:=clock_timestamp();
 IF NOT FOUND OR c.status<>'active' OR c.starts_at>v_now OR c.ends_at<=v_now THEN
  RAISE EXCEPTION 'Campanha fora do período autorizado ou suspensa.' USING ERRCODE='42501';
 END IF;
 IF NOT private.invitation_campaign_eligible(p_campaign,u) THEN
  RAISE EXCEPTION 'Sem autorização ou elegibilidade para esta campanha.' USING ERRCODE='42501';
 END IF;
 -- Also serialize retries/rate limits spanning different campaigns for one issuer.
 PERFORM pg_advisory_xact_lock(hashtextextended('campaign-issuer:'||u::text,0));
 SELECT * INTO i FROM public.user_invitations WHERE invited_by=u AND request_id=p_request_id;
 IF FOUND THEN
  IF i.campaign_id IS DISTINCT FROM p_campaign OR i.recipient_email IS DISTINCT FROM e THEN
   RAISE EXCEPTION 'O identificador do pedido já foi usado com outros dados.';
  END IF;
  IF i.used_at IS NOT NULL OR i.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Este convite já foi utilizado ou expirou.'; END IF;
  RETURN jsonb_build_object('code',i.code,'expires_at',i.expires_at);
 END IF;
 IF e IS NOT NULL THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('campaign-recipient:'||e,0));
  -- Email deduplication is separate from request idempotency. A different request
  -- must not silently acquire an existing token or create an untracked request alias.
  SELECT * INTO i FROM public.user_invitations WHERE campaign_id=p_campaign AND recipient_email=e;
  IF FOUND THEN
   IF i.invited_by=u AND i.used_at IS NULL AND i.expires_at>clock_timestamp() THEN
    RAISE EXCEPTION 'Já existe um convite para este destinatário. Consulta os convites emitidos.';
   END IF;
   RAISE EXCEPTION 'Destinatário indisponível para novo convite.';
  END IF;
  IF EXISTS(SELECT 1 FROM auth.users WHERE lower(trim(email))=e AND deleted_at IS NULL)
   OR EXISTS(SELECT 1 FROM public.user_invitations WHERE recipient_email=e AND used_at IS NULL
    AND (expires_at IS NULL OR expires_at>clock_timestamp())) THEN
   RAISE EXCEPTION 'Destinatário indisponível para novo convite.';
  END IF;
 END IF;
 SELECT count(*) INTO n FROM public.user_invitations WHERE campaign_id=p_campaign AND invited_by=u;
 IF n>=c.max_per_user THEN RAISE EXCEPTION 'Limite pessoal de convites atingido.'; END IF;
 IF (SELECT count(*) FROM public.user_invitations WHERE campaign_id=p_campaign)>=c.max_total THEN
  RAISE EXCEPTION 'Limite total da campanha atingido.';
 END IF;
 IF (SELECT count(*) FROM public.user_invitations WHERE invited_by=u AND campaign_id IS NOT NULL
  AND created_at>clock_timestamp()-interval '1 hour')>=10 THEN RAISE EXCEPTION 'Limite de emissão por hora atingido.'; END IF;
 v_now:=clock_timestamp();
 IF c.ends_at<=v_now THEN RAISE EXCEPTION 'Campanha terminada.'; END IF;
 LOOP
  v_code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  EXIT WHEN NOT EXISTS(SELECT 1 FROM public.user_invitations WHERE code=v_code)
   AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE upper(referral_code)=v_code)
   AND NOT EXISTS(SELECT 1 FROM public.mvp_candidates WHERE upper(access_code)=v_code);
 END LOOP;
 -- Advance the locked row version: stricter isolation must fail with a serialization
 -- error instead of checking a stale quota snapshot after a concurrent commit.
 UPDATE public.invitation_campaigns SET revision=revision+1 WHERE id=p_campaign;
 INSERT INTO public.user_invitations(code,invited_by,recipient_email,request_id,campaign_id,created_at,expires_at)
 VALUES(v_code,u,e,p_request_id,p_campaign,v_now,least(c.ends_at,v_now+make_interval(hours=>c.invite_ttl_hours))) RETURNING * INTO i;
 INSERT INTO public.invitation_campaign_audit(campaign_id,actor_id,action,details)
 VALUES(p_campaign,u,'invitation_issued',jsonb_build_object('code',v_code,'request_id',p_request_id));
 RETURN jsonb_build_object('code',i.code,'expires_at',i.expires_at);
END $$;

-- Read APIs never accept a caller-supplied owner ID. Members see only their own rows.
CREATE FUNCTION private.list_invitation_campaigns() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE admin boolean:=public.has_role(auth.uid(),'admin'); result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO result FROM (
  SELECT c.*,private.invitation_campaign_eligible(c.id,auth.uid()) AS eligible,
   (SELECT count(*) FROM public.user_invitations i WHERE i.campaign_id=c.id AND i.invited_by=auth.uid()) AS my_issued,
   (SELECT count(*) FROM public.user_invitations i WHERE i.campaign_id=c.id) AS total_issued
  FROM public.invitation_campaigns c WHERE admin OR EXISTS(SELECT 1 FROM public.invitation_campaign_members m
   WHERE m.campaign_id=c.id AND m.user_id=auth.uid()) ORDER BY c.created_at DESC LIMIT 100
 ) x;
 RETURN result;
END $$;

CREATE FUNCTION private.campaign_report(p_campaign uuid,p_offset integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE admin boolean:=public.has_role(auth.uid(),'admin'); result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501'; END IF;
 IF p_offset IS NULL OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Página inválida.'; END IF;
 IF NOT admin AND NOT EXISTS(SELECT 1 FROM public.invitation_campaign_members WHERE campaign_id=p_campaign AND user_id=auth.uid()) THEN
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

-- True for redemption of campaign tokens only while their authorization is in force.
-- Recent activity is an issuance criterion; merely logging out does not invalidate an issued token.
CREATE FUNCTION private.campaign_token_authorized(p_campaign uuid,p_user uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.invitation_campaigns c
 JOIN public.invitation_campaign_members m ON m.campaign_id=c.id AND m.user_id=p_user
 JOIN auth.users u ON u.id=m.user_id
 WHERE c.id=p_campaign AND c.status='active' AND c.starts_at<=clock_timestamp() AND c.ends_at>clock_timestamp()
  AND m.revoked_at IS NULL AND m.presence_valid_until>clock_timestamp()
  AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()));
$$;

-- API wrappers are invokers; privileges are concentrated in non-exposed private functions.
CREATE FUNCTION public.save_invitation_campaign(p_id uuid,p_config jsonb) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$ SELECT private.save_invitation_campaign(p_id,p_config) $$;
CREATE FUNCTION public.set_campaign_member(p_campaign uuid,p_email text,p_allowed boolean,p_reference text,p_valid_until timestamptz)
 RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.set_campaign_member(p_campaign,p_email,p_allowed,p_reference,p_valid_until) $$;
CREATE FUNCTION public.issue_campaign_invitation(p_campaign uuid,p_request_id uuid,p_email text DEFAULT NULL) RETURNS jsonb
 LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.issue_campaign_invitation(p_campaign,p_request_id,p_email) $$;
CREATE FUNCTION public.list_invitation_campaigns() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$ SELECT private.list_invitation_campaigns() $$;
CREATE FUNCTION public.campaign_report(p_campaign uuid,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=''
 AS $$ SELECT private.campaign_report(p_campaign,p_offset) $$;

-- The two old issuance entry points remain available only to the administrator.
-- Moving the originals preserves their behaviour for the initial admin-managed campaign.
ALTER FUNCTION public.issue_user_invitation(text) SET SCHEMA private;
ALTER FUNCTION public.issue_shareable_user_invitation(uuid) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.issue_user_invitation(text),private.issue_shareable_user_invitation(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION private.issue_user_invitation(p_email text)
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
    WHERE invited_by = v_owner AND recipient_email = v_email AND used_at IS NULL AND campaign_id IS NULL;
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

CREATE FUNCTION public.issue_user_invitation(p_email text) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.invitation_require_admin(); RETURN private.issue_user_invitation(p_email); END $$;
CREATE FUNCTION public.issue_shareable_user_invitation(p_request_id uuid) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN PERFORM private.invitation_require_admin(); RETURN private.issue_shareable_user_invitation(p_request_id); END $$;
-- Isolate the separately deployed, service-only initial-100 delivery workflow.
-- Fail closed on unexpected source drift instead of guessing at a production function.
DO $isolate_initial_campaign$
DECLARE definition text; updated text;
BEGIN
 IF to_regprocedure('public.claim_mvp_campaign_invite(uuid,text,text,text,boolean)') IS NOT NULL THEN
  SELECT pg_get_functiondef('public.claim_mvp_campaign_invite(uuid,text,text,text,boolean)'::regprocedure) INTO definition;
  updated:=replace(definition,
   'where invited_by=owner_id and recipient_email=v_email and used_at is null',
   'where invited_by=owner_id and recipient_email=v_email and used_at is null and campaign_id is null');
  IF updated=definition THEN RAISE EXCEPTION 'Initial campaign function changed; review its invitation lookup before applying this migration.'; END IF;
  definition:=updated;
  updated:=replace(definition,'where code=d.code and used_at is null',
   'where code=d.code and used_at is null and campaign_id is null');
  IF updated=definition THEN RAISE EXCEPTION 'Initial campaign function changed; review its expiry update before applying this migration.'; END IF;
  EXECUTE updated;
 END IF;
END $isolate_initial_campaign$;

-- Existing delegate permissions are retained solely for previously issued individual tokens.
-- Do not create a perpetual delegation for a campaign participant.
CREATE OR REPLACE FUNCTION public.set_invitation_permission(p_email text,p_allowed boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.invitation_require_admin();
 IF p_allowed IS DISTINCT FROM false THEN RAISE EXCEPTION 'Autoriza o participante dentro de uma campanha.'; END IF;
 DELETE FROM public.invitation_permissions WHERE user_id IN(SELECT id FROM public.profiles WHERE lower(trim(email))=lower(trim(p_email)));
END $$;

-- Retire delegated reusable profile codes; individual legacy tokens remain valid.
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
   WHERE upper(referral_code) = upper(trim(p_code)) AND public.has_role(id, 'admin') LIMIT 1;
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
DECLARE v_code text; v_invite public.user_invitations%ROWTYPE; v_ref text; v_campaign uuid;
BEGIN
  v_code := upper(trim(coalesce(nullif(NEW.raw_user_meta_data->>'access_code', ''), NEW.raw_user_meta_data->>'ref', '')));
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


CREATE OR REPLACE FUNCTION public.validate_mvp_access_code(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_invite public.user_invitations%ROWTYPE;
BEGIN
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
END $$;


REVOKE ALL ON FUNCTION private.invitation_require_admin(),private.invitation_campaign_eligible(uuid,uuid),
 private.campaign_token_authorized(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.save_invitation_campaign(uuid,jsonb),private.set_campaign_member(uuid,text,boolean,text,timestamptz),
 private.issue_campaign_invitation(uuid,uuid,text),private.list_invitation_campaigns(),private.campaign_report(uuid,integer),
 public.save_invitation_campaign(uuid,jsonb),public.set_campaign_member(uuid,text,boolean,text,timestamptz),
 public.issue_campaign_invitation(uuid,uuid,text),public.list_invitation_campaigns(),public.campaign_report(uuid,integer),
 public.issue_user_invitation(text),public.issue_shareable_user_invitation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.save_invitation_campaign(uuid,jsonb),private.set_campaign_member(uuid,text,boolean,text,timestamptz),
 private.issue_campaign_invitation(uuid,uuid,text),private.list_invitation_campaigns(),private.campaign_report(uuid,integer),
 public.save_invitation_campaign(uuid,jsonb),public.set_campaign_member(uuid,text,boolean,text,timestamptz),
 public.issue_campaign_invitation(uuid,uuid,text),public.list_invitation_campaigns(),public.campaign_report(uuid,integer),
 public.issue_user_invitation(text),public.issue_shareable_user_invitation(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_user_invitation_on_signup(),public.validate_legacy_mvp_access_code(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_mvp_access_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_mvp_access_code(text) TO anon,authenticated;
COMMIT;
