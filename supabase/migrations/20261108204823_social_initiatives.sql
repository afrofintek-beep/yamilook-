BEGIN;
CREATE TABLE public.social_initiatives (
 slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
 name text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
 campaign_id uuid UNIQUE REFERENCES public.invitation_campaigns(id),
 goal_invites integer NOT NULL DEFAULT 5 CHECK (goal_invites BETWEEN 0 AND 5),
 require_attendance boolean NOT NULL DEFAULT true,
 capacity integer CHECK (capacity BETWEEN 1 AND 20000),
 revision bigint NOT NULL DEFAULT 0,
 event_starts_on date NOT NULL DEFAULT DATE '2026-12-05'
);
CREATE TABLE public.social_condominiums (
 id text PRIMARY KEY, name text NOT NULL, area text NOT NULL
);
CREATE TABLE public.social_registrations (
 initiative text NOT NULL REFERENCES public.social_initiatives(slug),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 condominium_id text REFERENCES public.social_condominiums(id),
 other_condominium text CHECK (length(other_condominium) <= 120),
 afroloc_code text NOT NULL CHECK (length(afroloc_code) BETWEEN 3 AND 100),
 invite_code text UNIQUE REFERENCES public.user_invitations(code),
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 approved_at timestamptz, approved_by uuid REFERENCES public.profiles(id),
 valid_until timestamptz,
 evidence_reference text CHECK (length(evidence_reference) BETWEEN 8 AND 500),
 verified_condominium text REFERENCES public.social_condominiums(id),
 proximity_group text CHECK (length(proximity_group) BETWEEN 3 AND 120),
 attended_at timestamptz, attended_by uuid REFERENCES public.profiles(id),
 is_public boolean NOT NULL DEFAULT false,
 PRIMARY KEY (initiative,user_id),
 CHECK (approved_at IS NULL OR (approved_by IS NOT NULL AND valid_until IS NOT NULL AND evidence_reference IS NOT NULL)),
 CHECK (approved_at IS NULL OR approved_by <> user_id)
);
CREATE INDEX social_registration_user ON public.social_registrations(user_id,initiative);
CREATE TABLE public.social_distinctions (
 initiative text NOT NULL, user_id uuid NOT NULL,
 awarded_at timestamptz NOT NULL DEFAULT clock_timestamp(), revoked_at timestamptz,
 PRIMARY KEY (initiative,user_id),
 FOREIGN KEY (initiative,user_id) REFERENCES public.social_registrations(initiative,user_id) ON DELETE CASCADE
);
CREATE TABLE public.social_initiative_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 initiative text NOT NULL REFERENCES public.social_initiatives(slug),
 actor_id uuid, subject_id uuid, action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX social_audit_initiative ON public.social_initiative_audit(initiative,id DESC);
ALTER TABLE public.social_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_condominiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_distinctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_initiative_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.social_initiatives,public.social_condominiums,public.social_registrations,
 public.social_distinctions,public.social_initiative_audit FROM PUBLIC,anon,authenticated;
REVOKE ALL ON SEQUENCE public.social_initiative_audit_id_seq FROM PUBLIC,anon,authenticated;
INSERT INTO public.social_initiatives(slug,name) VALUES ('natal-solidario-talatona-2026','Feira de Natal Solidário 2026');

-- Administrative evidence is bound to the declared AFROLOC code. It is a campaign
-- eligibility decision, not a certificate issued on behalf of the AFROLOC authority.
CREATE FUNCTION private.social_address_current(p_slug text,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS (SELECT 1 FROM public.social_registrations r
 JOIN public.profiles p ON p.id=r.user_id JOIN auth.users u ON u.id=r.user_id
 WHERE r.initiative=p_slug AND r.user_id=p_user AND r.approved_at IS NOT NULL
 AND r.valid_until>statement_timestamp() AND r.afroloc_code=p.afroloc_code
 AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)
 AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
 AND u.email_confirmed_at IS NOT NULL);
$$;
CREATE FUNCTION private.social_neighbours(p_slug text,p_first uuid,p_second uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p_first<>p_second AND private.social_address_current(p_slug,p_first)
 AND private.social_address_current(p_slug,p_second) AND EXISTS (
 SELECT 1 FROM public.social_registrations a JOIN public.social_registrations b ON b.initiative=a.initiative
 WHERE a.initiative=p_slug AND a.user_id=p_first AND b.user_id=p_second
 AND ((a.verified_condominium IS NOT NULL AND a.verified_condominium=b.verified_condominium)
 OR (a.proximity_group IS NOT NULL AND a.proximity_group=b.proximity_group)));
$$;
CREATE FUNCTION private.social_completed_invites(p_slug text,p_user uuid) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT count(*)::integer FROM public.social_registrations r
 JOIN public.user_invitations i ON i.code=r.invite_code AND i.used_by=r.user_id
 JOIN public.social_initiatives s ON s.slug=r.initiative AND s.campaign_id=i.campaign_id
 WHERE r.initiative=p_slug AND i.invited_by=p_user
 AND private.social_neighbours(p_slug,p_user,r.user_id);
$$;
CREATE FUNCTION private.social_qualified(p_slug text,p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.social_registrations r JOIN public.social_initiatives s ON s.slug=r.initiative
 WHERE r.initiative=p_slug AND r.user_id=p_user AND private.social_address_current(p_slug,p_user)
 AND (NOT s.require_attendance OR r.attended_at IS NOT NULL)
 AND private.social_completed_invites(p_slug,p_user)>=s.goal_invites);
$$;
CREATE FUNCTION private.social_refresh_awards(p_slug text,p_revoke boolean DEFAULT false,p_subject uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item record;
BEGIN
 FOR item IN SELECT r.user_id,private.social_qualified(p_slug,r.user_id) AS qualified,
  d.awarded_at,d.revoked_at FROM public.social_registrations r
  LEFT JOIN public.social_distinctions d ON d.initiative=r.initiative AND d.user_id=r.user_id
  WHERE r.initiative=p_slug AND (r.user_id=p_subject OR EXISTS(
   SELECT 1 FROM public.social_registrations affected JOIN public.user_invitations token ON token.code=affected.invite_code
   WHERE affected.initiative=p_slug AND affected.user_id=p_subject AND token.invited_by=r.user_id)) LOOP
  IF item.qualified AND (item.awarded_at IS NULL OR item.revoked_at IS NOT NULL) THEN
   INSERT INTO public.social_distinctions(initiative,user_id) VALUES(p_slug,item.user_id)
   ON CONFLICT(initiative,user_id) DO UPDATE SET revoked_at=NULL;
   INSERT INTO public.social_initiative_audit(initiative,actor_id,subject_id,action)
   VALUES(p_slug,auth.uid(),item.user_id,'distinction_awarded');
  ELSIF p_revoke AND (item.user_id=p_subject OR EXISTS(
   SELECT 1 FROM public.social_registrations affected JOIN public.user_invitations token ON token.code=affected.invite_code
   WHERE affected.initiative=p_slug AND affected.user_id=p_subject AND token.invited_by=item.user_id)) AND NOT item.qualified AND item.awarded_at IS NOT NULL AND item.revoked_at IS NULL THEN
   UPDATE public.social_distinctions SET revoked_at=clock_timestamp() WHERE initiative=p_slug AND user_id=item.user_id;
   INSERT INTO public.social_initiative_audit(initiative,actor_id,subject_id,action)
   VALUES(p_slug,auth.uid(),item.user_id,'distinction_revoked');
  END IF;
 END LOOP;
END $$;

-- Keep the existing invitation and atomic Auth signup entry points. Only social
-- campaigns use the verified registration eligibility rule, allowing new residents
-- to invite after their own independent administrative review.
ALTER FUNCTION private.invitation_campaign_eligible(uuid,uuid) RENAME TO invitation_campaign_eligible_before_social;
CREATE FUNCTION private.invitation_campaign_eligible(p_campaign uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE slug text;
BEGIN
 SELECT s.slug INTO slug FROM public.social_initiatives s WHERE s.campaign_id=p_campaign;
 IF FOUND THEN RETURN private.social_address_current(slug,p_user); END IF;
 RETURN private.invitation_campaign_eligible_before_social(p_campaign,p_user);
END $$;
ALTER FUNCTION private.campaign_token_authorized(uuid,uuid) RENAME TO campaign_token_authorized_before_social;
CREATE FUNCTION private.campaign_token_authorized(p_campaign uuid,p_user uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE slug text;
BEGIN
 SELECT s.slug INTO slug FROM public.social_initiatives s WHERE s.campaign_id=p_campaign;
 IF FOUND THEN RETURN private.social_address_current(slug,p_user) AND EXISTS(
  SELECT 1 FROM public.invitation_campaigns c WHERE c.id=p_campaign AND c.status='active'
  AND c.starts_at<=clock_timestamp() AND c.ends_at>clock_timestamp()); END IF;
 RETURN private.campaign_token_authorized_before_social(p_campaign,p_user);
END $$;

-- Enforce the social quota even when the generic invitation endpoint is used.
CREATE FUNCTION private.social_invitation_quota() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.social_initiatives WHERE campaign_id=NEW.campaign_id) THEN
  PERFORM 1 FROM public.invitation_campaigns WHERE id=NEW.campaign_id FOR UPDATE;
  IF (SELECT count(*) FROM public.user_invitations WHERE campaign_id=NEW.campaign_id AND invited_by=NEW.invited_by)>=5 THEN
   RAISE EXCEPTION 'Limite de cinco convites atingido.';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.social_invitation_quota() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER social_invitation_quota BEFORE INSERT ON public.user_invitations
 FOR EACH ROW EXECUTE FUNCTION private.social_invitation_quota();

CREATE FUNCTION private.social_initiative_action(p_action text,p_slug text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.social_initiatives; c public.invitation_campaigns;
 r public.social_registrations; old_r public.social_registrations; invitation public.user_invitations;
 actor uuid:=auth.uid(); target uuid; result jsonb; rows jsonb; address_code text;
 cid text; other_name text; campaign uuid; allowed boolean; offset_value integer;
BEGIN
 IF p_action='profile' THEN
  target:=(p_payload->>'user_id')::uuid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('slug',s1.slug,'name',s1.name,
   'awarded_at',d.awarded_at,'registered_at',r1.registered_at,
   'awarded',d.awarded_at IS NOT NULL AND d.revoked_at IS NULL,
   'is_public',r1.is_public) ORDER BY r1.registered_at DESC),'[]'::jsonb) INTO rows
  FROM public.social_registrations r1 JOIN public.social_initiatives s1 ON s1.slug=r1.initiative
  LEFT JOIN public.social_distinctions d ON d.initiative=r1.initiative AND d.user_id=r1.user_id
  WHERE r1.user_id=target AND (target=actor OR r1.is_public);
  RETURN jsonb_build_object('initiatives',rows);
 END IF;
 SELECT * INTO s FROM public.social_initiatives WHERE slug=p_slug;
 IF NOT FOUND THEN RAISE EXCEPTION 'Iniciativa indisponível.'; END IF;
 IF p_action='catalog' THEN
  SELECT * INTO c FROM public.invitation_campaigns WHERE id=s.campaign_id;
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.area,x.name),'[]'::jsonb) INTO rows FROM public.social_condominiums x;
  RETURN jsonb_build_object('name',s.name,'goal_invites',s.goal_invites,'require_attendance',s.require_attendance,
   'status',coalesce(c.status,'draft'),'starts_at',c.starts_at,'ends_at',c.ends_at,'capacity',s.capacity,'condominiums',rows);
 END IF;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND deleted_at IS NULL
  AND NOT coalesce(is_anonymous,false) AND (banned_until IS NULL OR banned_until<=clock_timestamp())) THEN
  RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501';
 END IF;
 -- All state-changing actions serialize on the initiative, then its campaign.
 -- The row update also makes a stale repeatable-read transaction fail safely.
 SELECT * INTO s FROM public.social_initiatives WHERE slug=p_slug FOR UPDATE;
 SELECT * INTO c FROM public.invitation_campaigns WHERE id=s.campaign_id FOR UPDATE;
 SELECT * INTO r FROM public.social_registrations WHERE initiative=p_slug AND user_id=actor;
 IF p_action='configure' THEN
  PERFORM private.invitation_require_admin();
  IF (p_payload->>'capacity')::integer NOT BETWEEN 1 AND 20000 OR p_payload->>'capacity' IS NULL THEN
   RAISE EXCEPTION 'Define o limite de participantes entre 1 e 20000.'; END IF;
  IF (p_payload->>'goal_invites')::integer NOT BETWEEN 0 AND 5 OR p_payload->>'goal_invites' IS NULL
   OR jsonb_typeof(p_payload->'require_attendance') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Metas inválidas.'; END IF;
  IF EXISTS(SELECT 1 FROM public.social_registrations WHERE initiative=p_slug) AND
   (s.goal_invites<>(p_payload->>'goal_invites')::integer OR s.require_attendance<>(p_payload->>'require_attendance')::boolean) THEN
    RAISE EXCEPTION 'As metas ficam fixas após a primeira inscrição.'; END IF;
  IF (SELECT count(*) FROM public.social_registrations WHERE initiative=p_slug)>(p_payload->>'capacity')::integer THEN
   RAISE EXCEPTION 'O limite é inferior às inscrições existentes.'; END IF;
  result:=jsonb_build_object('name',s.name,'status',p_payload->>'status','starts_at',p_payload->>'starts_at',
   'ends_at',p_payload->>'ends_at','max_per_user',5,'max_total',(p_payload->>'capacity')::integer*5,
   'active_within_days',90,'min_account_days',0,'require_confirmed_email',true,'invite_ttl_hours',168);
  IF s.campaign_id IS NULL THEN
   campaign:=private.save_invitation_campaign(NULL,result||'{"status":"draft"}'::jsonb);
  ELSE campaign:=s.campaign_id; END IF;
  PERFORM private.save_invitation_campaign(campaign,result);
  UPDATE public.social_initiatives SET campaign_id=campaign,capacity=(p_payload->>'capacity')::integer,
   goal_invites=(p_payload->>'goal_invites')::integer,require_attendance=(p_payload->>'require_attendance')::boolean WHERE slug=p_slug;
 ELSIF p_action='register' THEN
  IF c.id IS NULL OR c.status<>'active' OR c.starts_at>clock_timestamp() OR c.ends_at<=clock_timestamp() THEN
   RAISE EXCEPTION 'As inscrições estão fechadas.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND email_confirmed_at IS NOT NULL) THEN
   RAISE EXCEPTION 'Confirma o email antes de te inscreveres.'; END IF;
  SELECT afroloc_code INTO address_code FROM public.profiles WHERE id=actor;
  IF nullif(trim(address_code),'') IS NULL THEN RAISE EXCEPTION 'Associa primeiro o endereço AFROLOC ao teu perfil.'; END IF;
  cid:=nullif(p_payload->>'condominium_id',''); other_name:=nullif(trim(p_payload->>'other_condominium'),'');
  IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.social_condominiums WHERE id=cid) THEN RAISE EXCEPTION 'Condomínio inválido.'; END IF;
  IF cid IS NULL AND other_name IS NULL THEN RAISE EXCEPTION 'Indica o condomínio ou a zona de residência.'; END IF;
  IF p_payload->>'consent' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirma a utilização do endereço nesta inscrição.'; END IF;
  IF r.user_id IS NULL AND (SELECT count(*) FROM public.social_registrations WHERE initiative=p_slug)>=s.capacity THEN
   RAISE EXCEPTION 'Limite de participantes atingido.'; END IF;
  IF nullif(p_payload->>'invite_code','') IS NOT NULL THEN
   SELECT * INTO invitation FROM public.user_invitations WHERE code=upper(trim(p_payload->>'invite_code')) AND campaign_id=s.campaign_id FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido.'; END IF;
  ELSE
   SELECT * INTO invitation FROM public.user_invitations WHERE campaign_id=s.campaign_id AND used_by=actor ORDER BY used_at LIMIT 1 FOR UPDATE;
  END IF;
  IF invitation.code IS NOT NULL THEN
   IF invitation.invited_by=actor OR (invitation.used_by IS NOT NULL AND invitation.used_by<>actor)
    OR NOT private.campaign_token_authorized(s.campaign_id,invitation.invited_by)
    OR (invitation.used_by IS NULL AND invitation.expires_at<=clock_timestamp()) THEN RAISE EXCEPTION 'Convite indisponível.'; END IF;
   IF invitation.recipient_email IS NOT NULL AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=actor AND lower(trim(email))=invitation.recipient_email) THEN
    RAISE EXCEPTION 'Convite indisponível.'; END IF;
   IF r.user_id IS NOT NULL AND r.invite_code IS DISTINCT FROM invitation.code THEN RAISE EXCEPTION 'A inscrição já tem a sua origem definida.'; END IF;
  END IF;
  IF invitation.code IS NOT NULL AND invitation.used_by IS NULL THEN
   UPDATE public.user_invitations SET used_by=actor,used_at=clock_timestamp() WHERE code=invitation.code;
  END IF;
  INSERT INTO public.social_registrations(initiative,user_id,condominium_id,other_condominium,afroloc_code,invite_code)
   VALUES(p_slug,actor,cid,other_name,address_code,invitation.code)
  ON CONFLICT(initiative,user_id) DO UPDATE SET condominium_id=excluded.condominium_id,
   other_condominium=excluded.other_condominium,afroloc_code=excluded.afroloc_code,
   approved_at=CASE WHEN (social_registrations.condominium_id,social_registrations.other_condominium,social_registrations.afroloc_code)
    IS DISTINCT FROM (excluded.condominium_id,excluded.other_condominium,excluded.afroloc_code) THEN NULL ELSE social_registrations.approved_at END;
 ELSIF p_action='issue' THEN
  IF NOT private.social_address_current(p_slug,actor) THEN RAISE EXCEPTION 'Aguarda a validação da residência.'; END IF;
  IF (SELECT count(*) FROM public.user_invitations WHERE campaign_id=s.campaign_id AND invited_by=actor)>=5
   AND NOT EXISTS(SELECT 1 FROM public.user_invitations WHERE invited_by=actor AND request_id=(p_payload->>'request_id')::uuid AND campaign_id=s.campaign_id) THEN
   RAISE EXCEPTION 'Limite de cinco convites atingido.'; END IF;
  result:=private.issue_campaign_invitation(s.campaign_id,(p_payload->>'request_id')::uuid,NULL);
 ELSIF p_action IN ('review','attendance') THEN
  PERFORM private.invitation_require_admin();
  target:=(p_payload->>'user_id')::uuid;
  IF target=actor THEN RAISE EXCEPTION 'Outro administrador deve validar a tua participação.'; END IF;
  SELECT * INTO old_r FROM public.social_registrations WHERE initiative=p_slug AND user_id=target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inscrição inexistente.'; END IF;
  IF jsonb_typeof(p_payload->'approved') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Decisão inválida.'; END IF;
  allowed:=(p_payload->>'approved')::boolean;
  IF p_action='attendance' THEN
   IF allowed AND (clock_timestamp() AT TIME ZONE 'Africa/Luanda')::date<s.event_starts_on THEN RAISE EXCEPTION 'A iniciativa ainda não começou.'; END IF;
   IF allowed AND NOT private.social_address_current(p_slug,target) THEN RAISE EXCEPTION 'Valida primeiro a residência.'; END IF;
   UPDATE public.social_registrations SET attended_at=CASE WHEN allowed THEN clock_timestamp() END,attended_by=actor WHERE initiative=p_slug AND user_id=target;
  ELSE
   IF allowed THEN
    IF old_r.afroloc_code IS DISTINCT FROM p_payload->>'expected_code' OR NOT EXISTS(
     SELECT 1 FROM public.profiles WHERE id=target AND afroloc_code=old_r.afroloc_code) THEN RAISE EXCEPTION 'O endereço mudou. Actualiza a inscrição.'; END IF;
    IF (p_payload->>'valid_until')::timestamptz IS NULL OR (p_payload->>'valid_until')::timestamptz<=clock_timestamp() THEN
     RAISE EXCEPTION 'Indica a validade da evidência.'; END IF;
    IF nullif(p_payload->>'verified_condominium','') IS NULL AND nullif(trim(p_payload->>'proximity_group'),'') IS NULL THEN
     RAISE EXCEPTION 'Confirma o condomínio ou o grupo de proximidade.'; END IF;
   END IF;
   UPDATE public.social_registrations SET approved_at=CASE WHEN allowed THEN clock_timestamp() END,
    approved_by=actor,valid_until=CASE WHEN allowed THEN (p_payload->>'valid_until')::timestamptz END,
    evidence_reference=CASE WHEN allowed THEN nullif(trim(p_payload->>'evidence_reference'),'') END,
    verified_condominium=CASE WHEN allowed THEN nullif(p_payload->>'verified_condominium','') END,
    proximity_group=CASE WHEN allowed THEN nullif(trim(p_payload->>'proximity_group'),'') END
   WHERE initiative=p_slug AND user_id=target;
  END IF;
 ELSIF p_action='visibility' THEN
  IF r.user_id IS NULL OR jsonb_typeof(p_payload->'is_public') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Pedido inválido.'; END IF;
  UPDATE public.social_registrations SET is_public=(p_payload->>'is_public')::boolean WHERE initiative=p_slug AND user_id=actor;
 ELSIF p_action NOT IN ('dashboard','report') THEN RAISE EXCEPTION 'Acção inválida.';
 END IF;
 IF p_action NOT IN ('dashboard','report') THEN
  UPDATE public.social_initiatives SET revision=revision+1 WHERE slug=p_slug;
  INSERT INTO public.social_initiative_audit(initiative,actor_id,subject_id,action,details) VALUES(p_slug,actor,coalesce(target,actor),p_action,p_payload);
  PERFORM private.social_refresh_awards(p_slug,p_action IN ('review','attendance') AND NOT coalesce(allowed,true),coalesce(target,actor));
 END IF;
 IF p_action='issue' THEN RETURN result; END IF;
 IF p_action='report' THEN
  PERFORM private.invitation_require_admin();
  offset_value:=coalesce((p_payload->>'offset')::integer,0);
  IF offset_value<0 THEN RAISE EXCEPTION 'Página inválida.'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) INTO rows FROM (
   SELECT r1.*,p.display_name,p.username,private.social_address_current(p_slug,r1.user_id) AS address_valid,
   private.social_completed_invites(p_slug,r1.user_id) AS completed_invites
   FROM public.social_registrations r1 JOIN public.profiles p ON p.id=r1.user_id
   WHERE r1.initiative=p_slug ORDER BY r1.registered_at,r1.user_id LIMIT 50 OFFSET offset_value) x;
  RETURN jsonb_build_object('registrations',rows,'total',(SELECT count(*) FROM public.social_registrations WHERE initiative=p_slug));
 END IF;
 SELECT * INTO r FROM public.social_registrations WHERE initiative=p_slug AND user_id=actor;
 SELECT coalesce(jsonb_agg(jsonb_build_object('code',i.code,'expires_at',i.expires_at,'used',i.used_at IS NOT NULL,
  'completed',EXISTS(SELECT 1 FROM public.social_registrations rr WHERE rr.invite_code=i.code AND private.social_neighbours(p_slug,actor,rr.user_id))) ORDER BY i.created_at),'[]'::jsonb)
 INTO rows FROM public.user_invitations i WHERE i.campaign_id=s.campaign_id AND i.invited_by=actor;
 RETURN jsonb_build_object('registration',CASE WHEN r.user_id IS NOT NULL THEN to_jsonb(r) END,
  'address_valid',private.social_address_current(p_slug,actor),'completed_invites',private.social_completed_invites(p_slug,actor),
  'awarded',EXISTS(SELECT 1 FROM public.social_distinctions d WHERE d.initiative=p_slug AND d.user_id=actor AND d.revoked_at IS NULL),
  'invitations',rows);
END $$;
CREATE FUNCTION public.social_initiative_action(p_action text,p_slug text,p_payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.social_initiative_action(p_action,p_slug,p_payload) $$;
REVOKE ALL ON FUNCTION private.social_address_current(text,uuid),private.social_neighbours(text,uuid,uuid),
 private.social_completed_invites(text,uuid),private.social_qualified(text,uuid),private.social_refresh_awards(text,boolean,uuid),
 private.invitation_campaign_eligible_before_social(uuid,uuid),private.campaign_token_authorized_before_social(uuid,uuid),
 private.invitation_campaign_eligible(uuid,uuid),private.campaign_token_authorized(uuid,uuid),
 private.social_initiative_action(text,text,jsonb),public.social_initiative_action(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.social_initiative_action(text,text,jsonb),public.social_initiative_action(text,text,jsonb) TO anon,authenticated;
INSERT INTO public.social_condominiums(id,name,area) VALUES
('acquaville-residencial-talatona','Acquaville Residencial Talatona','Talatona'),
('adelaide','Adelaide','Talatona'),
('diamante','Diamante','Talatona'),
('dolce-vita','Dolce Vita','Talatona'),
('flores-do-talatona','Flores do Talatona','Talatona'),
('imbondeiro-palace','Imbondeiro Palace','Talatona'),
('imoluanda','Imoluanda','Talatona'),
('infinity-residence','Infinity Residence','Talatona'),
('kyanda','Kyanda','Talatona'),
('laguna-residencial','Laguna Residencial','Talatona'),
('luar-de-talatona','Luar de Talatona','Talatona'),
('mama-muxima','Mama Muxima','Talatona'),
('mansoes-do-vale','Mansões do Vale','Talatona'),
('maravilhas-de-talatona','Maravilhas de Talatona','Talatona'),
('morada-dos-reis','Morada dos Reis','Talatona'),
('ocean-ville','Ocean Ville','Talatona'),
('old-villas','Old Villas','Talatona'),
('orquidea','Orquídea','Talatona'),
('palmeiras','Palmeiras','Talatona'),
('palms-residence','Palms Residence','Talatona'),
('paraiso','Paraíso','Talatona'),
('perolas-de-talatona','Pérolas de Talatona','Talatona'),
('pitanga','Pitanga','Talatona'),
('residencias-de-talatona','Residências de Talatona','Talatona'),
('bem-vindo','Bem-Vindo','Lar do Patriota'),
('candando','Candando','Lar do Patriota'),
('patriota-rubra','Patriota Rubra','Lar do Patriota'),
('vale-do-talatona','Vale do Talatona','Lar do Patriota'),
('vila-kuditemo','Vila Kuditemo','Lar do Patriota'),
('condominio-dos-astros','Condomínio dos Astros','Município de Talatona · zona a confirmar'),
('lady-yasmin','Lady Yasmin','Município de Talatona · zona a confirmar'),
('ouro-verde-2','Ouro Verde 2','Município de Talatona · zona a confirmar');
COMMIT;
