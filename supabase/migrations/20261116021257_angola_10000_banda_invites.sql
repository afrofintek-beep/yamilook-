BEGIN;
-- Separate from fair invitations and legacy MVP campaigns. Country is a declared
-- residence preference, not proof of nationality, identity or AFROLOC certification.
CREATE TABLE private.angola_beta_config (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), enabled boolean NOT NULL DEFAULT false,
 capacity integer NOT NULL DEFAULT 10000 CHECK(capacity BETWEEN 1 AND 10000),
 starts_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 ends_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '60 days',
 revision bigint NOT NULL DEFAULT 0
);
INSERT INTO private.angola_beta_config(id) VALUES(true);
CREATE TABLE private.angola_beta_members (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
 joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 source text NOT NULL CHECK(source IN ('existing','open','banda','legacy')),
 excluded boolean NOT NULL DEFAULT false
);
CREATE TABLE private.angola_beta_invites (
 code text PRIMARY KEY CHECK(code ~ '^BA[A-F0-9]{14}$'),
 owner_id uuid NOT NULL REFERENCES private.angola_beta_members(user_id) ON DELETE CASCADE,
 slot integer NOT NULL CHECK(slot BETWEEN 1 AND 5),
 used_by uuid UNIQUE REFERENCES auth.users(id) DEFERRABLE INITIALLY DEFERRED,
 used_at timestamptz, UNIQUE(owner_id,slot),
 CHECK ((used_by IS NULL)=(used_at IS NULL))
);
CREATE TABLE private.angola_beta_waitlist (
 email text PRIMARY KEY CHECK(length(email)<=254 AND email=lower(trim(email))),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE private.angola_beta_feedback (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 message text NOT NULL CHECK(length(message) BETWEEN 5 AND 2000), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE private.angola_beta_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.angola_beta_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.angola_beta_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.angola_beta_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.angola_beta_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.angola_beta_config,private.angola_beta_members,private.angola_beta_invites,private.angola_beta_waitlist,private.angola_beta_feedback FROM PUBLIC,anon,authenticated;

-- Existing accounts retain all access. Exclude administrative/internal test accounts.
INSERT INTO private.angola_beta_members(user_id,source)
SELECT p.id,'existing' FROM public.profiles p JOIN auth.users u ON u.id=p.id
WHERE p.country_code='AO' AND p.account_status::text='active' AND u.deleted_at IS NULL
 AND NOT coalesce(u.is_anonymous,false) AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
 AND coalesce(u.email,'') NOT LIKE '%@yamilook.test' AND NOT public.has_role(p.id,'admin');
DO $$ BEGIN IF (SELECT count(*) FROM private.angola_beta_members)>10000 THEN RAISE EXCEPTION 'Existing cohort exceeds capacity'; END IF; END $$;

CREATE FUNCTION private.angola_beta_eligible(p_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.angola_beta_members m JOIN auth.users u ON u.id=m.user_id
 JOIN public.profiles p ON p.id=m.user_id WHERE m.user_id=p_user AND NOT m.excluded
 AND p.account_status::text='active' AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false)
 AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
 AND coalesce(u.email_confirmed_at,u.phone_confirmed_at) IS NOT NULL);
$$;
CREATE FUNCTION private.angola_beta_make_invites(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE slot_number integer; token text;
BEGIN
 IF NOT private.angola_beta_eligible(p_user) THEN RETURN; END IF;
 PERFORM 1 FROM private.angola_beta_members WHERE user_id=p_user FOR UPDATE;
 FOR slot_number IN 1..5 LOOP
  IF NOT EXISTS(SELECT 1 FROM private.angola_beta_invites WHERE owner_id=p_user AND slot=slot_number) THEN
   LOOP
    token:='BA'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,14));
    EXIT WHEN NOT EXISTS(SELECT 1 FROM private.angola_beta_invites WHERE code=token)
     AND NOT EXISTS(SELECT 1 FROM public.user_invitations WHERE code=token);
   END LOOP;
   INSERT INTO private.angola_beta_invites(code,owner_id,slot) VALUES(token,p_user,slot_number);
  END IF;
 END LOOP;
END $$;

-- Reservations count towards capacity, but only confirmed accounts appear publicly.
-- Keep reservations until account removal/review; never silently break confirmation links.
CREATE FUNCTION private.angola_beta_reserve(p_user uuid,p_code text,p_country text,p_email text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.angola_beta_config; invitation private.angola_beta_invites; is_banda boolean;
BEGIN
 SELECT * INTO invitation FROM private.angola_beta_invites WHERE code=p_code;
 is_banda:=FOUND;
 IF p_country IS DISTINCT FROM 'AO' THEN
  IF is_banda THEN RAISE EXCEPTION 'ANGOLA_ONLY: Este convite destina-se a residentes em Angola.'; END IF;
  RETURN false;
 END IF;
 SELECT * INTO c FROM private.angola_beta_config WHERE id FOR UPDATE;
 IF NOT c.enabled OR clock_timestamp()<c.starts_at OR clock_timestamp()>=c.ends_at THEN
  -- Preserve legitimate legacy invitation flows when this campaign is paused.
  IF nullif(p_code,'') IS NOT NULL AND NOT is_banda THEN RETURN false; END IF;
  RAISE EXCEPTION 'ANGOLA_CLOSED: As inscrições desta campanha estão encerradas.';
 END IF;
 IF (SELECT count(*) FROM private.angola_beta_members WHERE NOT excluded)>=c.capacity THEN
  RAISE EXCEPTION 'ANGOLA_FULL: As vagas estão preenchidas. Junta-te à lista de espera.';
 END IF;
 IF is_banda THEN
  SELECT * INTO invitation FROM private.angola_beta_invites WHERE code=p_code FOR UPDATE;
  IF invitation.used_at IS NOT NULL OR NOT private.angola_beta_eligible(invitation.owner_id) THEN
   RAISE EXCEPTION 'ANGOLA_INVITE_UNAVAILABLE: Convite utilizado ou indisponível.';
  END IF;
  UPDATE private.angola_beta_invites SET used_by=p_user,used_at=clock_timestamp() WHERE code=p_code;
 END IF;
 INSERT INTO private.angola_beta_members(user_id,invited_by,source)
 VALUES(p_user,CASE WHEN is_banda THEN invitation.owner_id END,
 CASE WHEN is_banda THEN 'banda' WHEN nullif(p_code,'') IS NULL THEN 'open' ELSE 'legacy' END);
 UPDATE private.angola_beta_config SET revision=revision+1 WHERE id;
 RETURN is_banda OR nullif(p_code,'') IS NULL;
END $$;

-- Surgical patches retain current legacy and shared-registration-link behaviour.
-- Fail closed if the inspected entrypoints have changed, rather than overwrite them.
DO $patch$
DECLARE definition text; marker text;
BEGIN
 definition:=pg_get_functiondef('public.consume_user_invitation_on_signup()'::regprocedure);
 marker:='  v_ref := private.consume_registration_link(v_code, NEW.id, NEW.email);';
 IF position(marker IN definition)=0 THEN RAISE EXCEPTION 'Review current signup invitation function before migration'; END IF;
 definition:=replace(definition,marker,$inject$
  IF private.angola_beta_reserve(NEW.id,v_code,NEW.raw_user_meta_data->'onboarding_draft'->>'country',NEW.email) THEN
    RETURN NEW;
  END IF;
$inject$||marker);
 EXECUTE definition;
 definition:=pg_get_functiondef('public.handle_new_user()'::regprocedure);
 marker:='  IF NOT v_ok THEN';
 IF position(marker IN definition)=0 OR position('INSERT INTO public.profiles (id, email, display_name, username, referred_by)' IN definition)=0 THEN
  RAISE EXCEPTION 'Review current profile creation function before migration'; END IF;
 definition:=replace(definition,marker,$inject$
  IF EXISTS(SELECT 1 FROM private.angola_beta_members WHERE user_id=NEW.id AND NOT excluded) THEN
    v_ok:=true;
    SELECT coalesce(invited_by,v_referrer) INTO v_referrer FROM private.angola_beta_members WHERE user_id=NEW.id;
  END IF;
$inject$||marker);
 definition:=replace(definition,'INSERT INTO public.profiles (id, email, display_name, username, referred_by)',
 'INSERT INTO public.profiles (id, email, display_name, username, referred_by, country_code)');
 definition:=replace(definition,E'    v_referrer\n  );',E'    v_referrer, CASE WHEN EXISTS(SELECT 1 FROM private.angola_beta_members WHERE user_id=NEW.id) THEN ''AO'' ELSE NULL END\n  );');
 EXECUTE definition;
END $patch$;

CREATE FUNCTION private.angola_beta_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM private.angola_beta_make_invites(NEW.id); RETURN NEW;
END $$;
CREATE TRIGGER zz_angola_beta_confirmed AFTER INSERT OR UPDATE OF email_confirmed_at,phone_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION private.angola_beta_confirmation();
DO $$ DECLARE member record; BEGIN
 FOR member IN SELECT user_id FROM private.angola_beta_members LOOP
  PERFORM private.angola_beta_make_invites(member.user_id);
 END LOOP;
END $$;

CREATE FUNCTION private.angola_beta_action(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c private.angola_beta_config; actor uuid:=auth.uid(); confirmed integer; occupied integer; token private.angola_beta_invites;
 result jsonb; email_value text;
BEGIN
 SELECT * INTO c FROM private.angola_beta_config WHERE id;
 IF p_action IN ('status','check') THEN
  SELECT count(*) INTO occupied FROM private.angola_beta_members WHERE NOT excluded;
  SELECT count(*) INTO confirmed FROM private.angola_beta_members WHERE private.angola_beta_eligible(user_id);
  result:=jsonb_build_object('confirmed',confirmed,'capacity',c.capacity,'available',greatest(0,c.capacity-occupied),
   'open',c.enabled AND clock_timestamp()>=c.starts_at AND clock_timestamp()<c.ends_at AND occupied<c.capacity,
   'starts_at',c.starts_at,'ends_at',c.ends_at);
  IF p_action='check' THEN
   SELECT * INTO token FROM private.angola_beta_invites WHERE code=upper(trim(p_payload->>'code'));
   RETURN result||jsonb_build_object('banda_invite',FOUND,'valid',FOUND AND token.used_at IS NULL AND private.angola_beta_eligible(token.owner_id));
  END IF;
  RETURN result;
 END IF;
 IF p_action='waitlist' THEN
  email_value:=lower(trim(p_payload->>'email'));
  IF email_value IS NULL OR length(email_value)>254 OR email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Email inválido.'; END IF;
  IF p_payload->>'consent' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirma a inscrição na lista de espera.'; END IF;
  PERFORM 1 FROM private.angola_beta_config WHERE id FOR UPDATE;
  IF (SELECT count(*) FROM private.angola_beta_waitlist)<20000 THEN
   INSERT INTO private.angola_beta_waitlist(email) VALUES(email_value) ON CONFLICT DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok',true);
 END IF;
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles p ON p.id=u.id WHERE u.id=actor
  AND u.deleted_at IS NULL AND NOT coalesce(u.is_anonymous,false) AND p.account_status::text='active'
  AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())) THEN RAISE EXCEPTION 'Autenticação necessária.' USING ERRCODE='42501'; END IF;
 IF p_action='mine' THEN
  PERFORM private.angola_beta_make_invites(actor);
  RETURN jsonb_build_object('eligible',private.angola_beta_eligible(actor),'invites',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'code',i.code,'slot',i.slot,'used',i.used_at IS NOT NULL,'confirmed',coalesce(private.angola_beta_eligible(i.used_by),false)) ORDER BY i.slot)
   FROM private.angola_beta_invites i WHERE i.owner_id=actor),'[]'::jsonb));
 END IF;
 IF p_action='feedback' THEN
  PERFORM 1 FROM public.profiles WHERE id=actor FOR UPDATE;
  IF (SELECT count(*) FROM private.angola_beta_feedback WHERE user_id=actor AND created_at>clock_timestamp()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Já recebemos cinco mensagens nesta hora. Tenta mais tarde.'; END IF;
  INSERT INTO private.angola_beta_feedback(user_id,message) VALUES(actor,trim(p_payload->>'message'));
  RETURN jsonb_build_object('ok',true);
 END IF;
 PERFORM private.invitation_require_admin();
 IF p_action='configure' THEN
  IF jsonb_typeof(p_payload->'enabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Estado inválido.'; END IF;
  UPDATE private.angola_beta_config SET enabled=(p_payload->>'enabled')::boolean,revision=revision+1 WHERE id;
 ELSIF p_action<>'report' THEN RAISE EXCEPTION 'Operação inválida.'; END IF;
 RETURN (SELECT jsonb_build_object('enabled',enabled,'ends_at',ends_at,'capacity',capacity,
  'registered',(SELECT count(*) FROM private.angola_beta_members WHERE NOT excluded),
  'confirmed',(SELECT count(*) FROM private.angola_beta_members WHERE private.angola_beta_eligible(user_id)),
  'daily_active',(SELECT count(*) FROM private.angola_beta_members m JOIN public.profiles p ON p.id=m.user_id WHERE private.angola_beta_eligible(m.user_id) AND p.last_seen>clock_timestamp()-interval '1 day'),
  'weekly_active',(SELECT count(*) FROM private.angola_beta_members m JOIN public.profiles p ON p.id=m.user_id WHERE private.angola_beta_eligible(m.user_id) AND p.last_seen>clock_timestamp()-interval '7 days'),
  'online',(SELECT count(*) FROM private.angola_beta_members m JOIN public.profiles p ON p.id=m.user_id WHERE private.angola_beta_eligible(m.user_id) AND p.last_seen>clock_timestamp()-interval '5 minutes'),
  'invites_used',(SELECT count(*) FROM private.angola_beta_invites WHERE used_at IS NOT NULL),
  'waitlist',(SELECT count(*) FROM private.angola_beta_waitlist),
  'feedback',coalesce((SELECT jsonb_agg(to_jsonb(f)) FROM (SELECT id,message,created_at FROM private.angola_beta_feedback ORDER BY created_at DESC LIMIT 50) f),'[]'::jsonb)) FROM private.angola_beta_config WHERE id);
END $$;
CREATE FUNCTION public.angola_beta(p_action text,p_payload jsonb DEFAULT '{}'::jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.angola_beta_action(p_action,p_payload) $$;
REVOKE ALL ON FUNCTION private.angola_beta_eligible(uuid),private.angola_beta_make_invites(uuid),
 private.angola_beta_reserve(uuid,text,text,text),private.angola_beta_confirmation(),
 private.angola_beta_action(text,jsonb),public.angola_beta(text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA private TO anon,authenticated;
GRANT EXECUTE ON FUNCTION private.angola_beta_action(text,jsonb),public.angola_beta(text,jsonb) TO anon,authenticated;
COMMIT;
