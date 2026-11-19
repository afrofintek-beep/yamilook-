CREATE TABLE private.registration_holds (
 ticket uuid PRIMARY KEY, link_id uuid NOT NULL REFERENCES private.registration_links(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE INDEX registration_holds_link ON private.registration_holds(link_id,expires_at);
ALTER TABLE private.registration_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.registration_holds FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.registration_remaining(l private.registration_links) RETURNS integer
LANGUAGE sql VOLATILE SET search_path='' AS $$
 SELECT greatest(0,l.max_uses-l.uses_count-count(*)::int) FROM private.registration_holds
 WHERE link_id=l.id AND expires_at>clock_timestamp()
$$;
REVOKE ALL ON FUNCTION private.registration_remaining(private.registration_links) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.reserve_registration_place(p_code text,p_ticket uuid) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE l private.registration_links%ROWTYPE; deadline timestamptz;
BEGIN
 SELECT * INTO l FROM private.registration_links WHERE code=upper(trim(p_code)) FOR UPDATE;
 IF NOT FOUND OR l.status<>'active' OR NOT public.has_role(l.created_by,'admin') OR l.expires_at<=clock_timestamp() THEN
 RETURN json_build_object('valid',false,'error','Este convite já não está disponível.'); END IF;
 DELETE FROM private.registration_holds WHERE link_id=l.id AND expires_at<=clock_timestamp();
 SELECT expires_at INTO deadline FROM private.registration_holds WHERE ticket=p_ticket AND link_id=l.id;
 IF deadline IS NULL THEN
 IF private.registration_remaining(l)=0 THEN RETURN json_build_object('valid',false,'error','Já não há vagas disponíveis.'); END IF;
 deadline:=least(l.expires_at,clock_timestamp()+interval '15 minutes');
 INSERT INTO private.registration_holds VALUES(p_ticket,l.id,deadline);
 END IF;
 RETURN json_build_object('valid',true,'expires_at',deadline);
END $$;
REVOKE ALL ON FUNCTION public.reserve_registration_place(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_registration_place(text,uuid) TO anon,authenticated;

CREATE OR REPLACE FUNCTION private.validate_registration_link(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v private.registration_links%ROWTYPE;
BEGIN
 IF upper(p_code) LIKE 'HOLD:%' THEN
 SELECT l.* INTO v FROM private.registration_links l JOIN private.registration_holds h ON h.link_id=l.id
 WHERE upper(h.ticket::text)=upper(substr(p_code,6)) AND h.expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN json_build_object('valid',false,'error','A tua reserva terminou. Volta a abrir o convite.'); END IF;
 ELSE SELECT * INTO v FROM private.registration_links WHERE code=upper(trim(p_code));
 IF NOT FOUND THEN RETURN NULL; END IF; END IF;
 IF v.status<>'active' OR NOT public.has_role(v.created_by,'admin') THEN
  RETURN json_build_object('valid',false,'error','Este convite já não está autorizado');
 END IF;
 IF v.expires_at<=clock_timestamp() THEN RETURN json_build_object('valid',false,'error','Este convite expirou'); END IF;
 IF upper(p_code) LIKE 'HOLD:%' THEN RETURN json_build_object('valid',true); END IF;
 IF private.registration_remaining(v)=0 THEN RETURN json_build_object('valid',false,'error','Este convite atingiu o limite de inscrições'); END IF;
 RETURN json_build_object('valid',true,'multi_use',true,'remaining',private.registration_remaining(v),'total',v.max_uses,'expires_at',v.expires_at);
END $$;
CREATE OR REPLACE FUNCTION private.consume_registration_link(p_code text,p_user uuid,p_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v private.registration_links%ROWTYPE; v_ref text;
BEGIN
 IF upper(p_code) LIKE 'HOLD:%' THEN
 SELECT l.* INTO v FROM private.registration_links l JOIN private.registration_holds h ON h.link_id=l.id
 WHERE upper(h.ticket::text)=upper(substr(p_code,6)) AND h.expires_at>clock_timestamp() FOR UPDATE OF l;
 IF NOT FOUND THEN RAISE EXCEPTION 'A tua reserva terminou'; END IF;
 DELETE FROM private.registration_holds WHERE link_id=v.id AND upper(ticket::text)=upper(substr(p_code,6)) AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RAISE EXCEPTION 'A tua reserva terminou'; END IF;
 ELSE SELECT * INTO v FROM private.registration_links WHERE code=p_code FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF; END IF;
 IF v.status<>'active' OR NOT public.has_role(v.created_by,'admin') THEN RAISE EXCEPTION 'Este convite já não está autorizado'; END IF;
 IF v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Este convite expirou'; END IF;
 IF private.registration_remaining(v)=0 THEN RAISE EXCEPTION 'Este convite atingiu o limite de inscrições'; END IF;
 IF nullif(trim(p_email),'') IS NULL THEN RAISE EXCEPTION 'Email obrigatório'; END IF;
 SELECT referral_code INTO v_ref FROM public.profiles WHERE id=v.created_by;
 IF v_ref IS NULL THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
 UPDATE private.registration_links SET uses_count=uses_count+1 WHERE id=v.id;
 INSERT INTO private.registration_link_redemptions(user_id,link_id) VALUES(p_user,v.id);
 INSERT INTO private.registration_link_audit(link_id,actor_id,action) VALUES(v.id,p_user,'registered');
 RETURN v_ref;
END $$;
CREATE OR REPLACE FUNCTION private.admin_registration_links(p_link uuid DEFAULT NULL,p_status text DEFAULT NULL)
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
    private.registration_remaining(l) AS remaining
  FROM private.registration_links l ORDER BY l.created_at DESC LIMIT 100
 ) x;
 RETURN result;
END $$;
