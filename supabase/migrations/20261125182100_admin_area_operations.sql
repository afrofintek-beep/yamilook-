-- Apply area permissions at the existing operation boundaries.

CREATE OR REPLACE FUNCTION public.set_afroloc_certification(p_user_id uuid, p_certified boolean)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public.admin_area_allowed('admin_certifications') THEN
    RETURN json_build_object('success',false,'error','forbidden'); END IF;
  UPDATE public.profiles SET
    afroloc_certification_status = CASE WHEN p_certified THEN 'certified' ELSE 'rejected' END,
    afroloc_certified_at = CASE WHEN p_certified THEN now() ELSE NULL END,
    afroloc_certified_by = CASE WHEN p_certified THEN v_uid ELSE NULL END,
    updated_at = now()
  WHERE id = p_user_id;
  INSERT INTO integration_access_private.audit(actor_id,feature,target_id,action,after_value)
    VALUES(v_uid,'admin_certifications',p_user_id,'certification_review',jsonb_build_object('certified',p_certified));
  RETURN json_build_object('success',true);
END; $function$
;

CREATE OR REPLACE FUNCTION public.afroloc_registry(action text, data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 actor uuid := auth.uid();
 admin boolean := public.admin_area_allowed('admin_addresses');
 addr uuid := (data->>'id')::uuid;
 target uuid;
 entry afroloc_experience_private.assignments;
 result jsonb;
begin
 if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id where s.id=(auth.jwt()->>'session_id')::uuid and u.id=actor and not coalesce(u.is_anonymous,false)) then raise exception 'Sessão necessária'; end if;
 if action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'code',a.code,'public',r.is_public,'mine',r.recipient=actor,'accepted',r.accepted_at is not null,'pending',r.recipient is not null and r.accepted_at is null,'recipient',case when admin then p.username end,'status',a.status) order by a.created_at desc),'[]') into result
  from afroloc_experience_private.assignments r join public.afroloc_experience_addresses a on a.id=r.address_id left join public.profiles p on p.id=r.recipient
  where a.status not in ('closed','rejected') and a.expires_at>now() and (admin or r.recipient=actor or r.is_public);
  return jsonb_build_object('admin',admin,'rows',result);
 end if;
 if action='create' and admin then
  perform pg_advisory_xact_lock(hashtextextended(addr::text,1));
  if exists(select 1 from afroloc_experience_private.assignments where address_id=addr and creator=actor) then return '{}'::jsonb; end if;
  if exists(select 1 from public.afroloc_experience_addresses where id=addr) then raise exception 'Pedido indisponível'; end if;
  perform afroloc_experience_private.handle('create',data);
  perform pg_advisory_xact_lock(hashtextextended((select code from public.afroloc_experience_addresses where id=addr),2));
  if exists(select 1 from public.afroloc_experience_addresses a join public.afroloc_experience_addresses b on b.code=a.code and b.id<>a.id where a.id=addr and b.status<>'closed' and b.expires_at>now()) and (data->>'confirmDuplicate') is distinct from 'true' then raise exception 'Possível duplicado. Confirme que se trata de outro endereço.'; end if;
  insert into afroloc_experience_private.assignments values(addr,actor,coalesce((data->>'public')::boolean,false),null,null);
 elsif action in ('assign','accept') then
  select * into entry from afroloc_experience_private.assignments where address_id=addr for update;
  if not found or not exists(select 1 from public.afroloc_experience_addresses where id=addr and status not in ('closed','rejected') and expires_at>now() for update) then raise exception 'Endereço indisponível'; end if;
  if action='assign' and admin and entry.accepted_at is null then
   select id into strict target from public.profiles where lower(username)=lower(trim(leading '@' from trim(data->>'username'))) and upper(trim(country_code))='AO';
   update afroloc_experience_private.assignments set recipient=target where address_id=addr;
  elsif action='accept' and entry.recipient=actor then
   if entry.accepted_at is not null then return '{}'::jsonb; end if;
   update afroloc_experience_private.assignments set accepted_at=now() where address_id=addr;
   update public.afroloc_experience_addresses set owner_id=actor where id=addr;
  else raise exception 'Operação indisponível'; end if;
 else raise exception 'Sem permissão'; end if;
 insert into afroloc_experience_private.audit(actor,action,address_id) values(actor,case when action='assign' then action||':'||target::text else 'registry_'||action end,addr);
 return '{}'::jsonb;
exception when no_data_found then raise exception 'Utilizador de Angola não encontrado';
end $function$
;

CREATE OR REPLACE FUNCTION public.process_payout(p_payout_id uuid, p_action text, p_reason text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_admin uuid := auth.uid(); v_p public.payout_requests; v_new_balance integer; v_hold int;
begin
  if not public.admin_area_allowed('admin_payouts') then raise exception 'Sem permissão.'; end if;
  select * into v_p from public.payout_requests where id = p_payout_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;

  if p_action = 'approve' then
    if v_p.status <> 'pending' then raise exception 'Só se aprova um pedido pendente.'; end if;
    update public.payout_requests set status='approved', processed_by=v_admin, updated_at=now() where id=p_payout_id;
  elsif p_action = 'process' then
    if v_p.status <> 'approved' then raise exception 'Só se paga um pedido aprovado.'; end if;
    select coalesce(payout_hold_days,0) into v_hold from public.billing_config where id = 1;
    if v_hold > 0 and v_p.created_at > now() - make_interval(days => v_hold) then
      raise exception 'Período de retenção: só se pode pagar % dias após o pedido.', v_hold;
    end if;
    update public.payout_requests set status='processed', processed_by=v_admin, processed_at=now(), updated_at=now() where id=p_payout_id;
  elsif p_action = 'reject' then
    if v_p.status not in ('pending','approved') then raise exception 'Este pedido já foi finalizado.'; end if;
    update public.profiles
      set kumbu_available = kumbu_available + v_p.amount_kumbu,
          kumbu_earned = kumbu_earned + v_p.amount_kumbu, updated_at = now()
      where id = v_p.user_id returning kumbu_available into v_new_balance;
    insert into public.kumbu_ledger (user_id, amount, action_type, source, reference_id, description, balance_after)
      values (v_p.user_id, v_p.amount_kumbu, 'payout', 'payout_refund', p_payout_id, 'Payout rejeitado — Kumbu devolvido', v_new_balance);
    update public.payout_requests set status='rejected', rejection_reason=p_reason, processed_by=v_admin, processed_at=now(), updated_at=now() where id=p_payout_id;
  else
    raise exception 'Ação inválida.';
  end if;
  insert into integration_access_private.audit(actor_id,feature,target_id,action,before_value,after_value)
    values(v_admin,'admin_payouts',v_p.user_id,'payout_'||p_action,jsonb_build_object('requestId',v_p.id,'status',v_p.status),jsonb_build_object('action',p_action));
  return json_build_object('success', true, 'action', p_action);
end;
$function$
;

CREATE OR REPLACE FUNCTION private.invitation_require_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.admin_area_allowed('admin_campaigns') THEN
  RAISE EXCEPTION 'Só o administrador pode gerir campanhas.' USING ERRCODE='42501';
 END IF;
END $function$
;

CREATE OR REPLACE FUNCTION private.campaign_report(p_campaign uuid, p_offset integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE admin boolean:=public.admin_area_allowed('admin_campaigns'); result jsonb;
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
END $function$
;

CREATE OR REPLACE FUNCTION private.validate_registration_link(p_code text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v private.registration_links%ROWTYPE;
BEGIN
 IF upper(p_code) LIKE 'HOLD:%' THEN
 SELECT l.* INTO v FROM private.registration_links l JOIN private.registration_holds h ON h.link_id=l.id
 WHERE upper(h.ticket::text)=upper(substr(p_code,6)) AND h.expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN json_build_object('valid',false,'error','A tua reserva terminou. Volta a abrir o convite.'); END IF;
 ELSE SELECT * INTO v FROM private.registration_links WHERE code=upper(trim(p_code));
 IF NOT FOUND THEN RETURN NULL; END IF; END IF;
 IF v.status<>'active' OR NOT integration_access_private.area_granted(v.created_by,'admin_campaigns') THEN
  RETURN json_build_object('valid',false,'error','Este convite já não está autorizado');
 END IF;
 IF v.expires_at<=clock_timestamp() THEN RETURN json_build_object('valid',false,'error','Este convite expirou'); END IF;
 IF upper(p_code) LIKE 'HOLD:%' THEN RETURN json_build_object('valid',true); END IF;
 IF private.registration_remaining(v)=0 THEN RETURN json_build_object('valid',false,'error','Este convite atingiu o limite de inscrições'); END IF;
 RETURN json_build_object('valid',true,'multi_use',true,'remaining',private.registration_remaining(v),'total',v.max_uses,'expires_at',v.expires_at);
END $function$
;

CREATE OR REPLACE FUNCTION private.create_registration_link(p_request_id uuid, p_name text, p_max_uses integer, p_ttl_hours integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v private.registration_links%ROWTYPE; v_code text; v_actor uuid:=auth.uid();
BEGIN
 IF v_actor IS NULL OR NOT public.admin_area_allowed('admin_campaigns') THEN RAISE EXCEPTION 'Só o administrador pode gerir convites.' USING ERRCODE='42501'; END IF;
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
END $function$
;

CREATE OR REPLACE FUNCTION private.list_invitation_campaigns()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE admin boolean:=public.admin_area_allowed('admin_campaigns'); result jsonb;
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
END $function$
;

CREATE OR REPLACE FUNCTION private.consume_registration_link(p_code text, p_user uuid, p_email text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 IF v.status<>'active' OR NOT integration_access_private.area_granted(v.created_by,'admin_campaigns') THEN RAISE EXCEPTION 'Este convite já não está autorizado'; END IF;
 IF v.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Este convite expirou'; END IF;
 IF private.registration_remaining(v)=0 THEN RAISE EXCEPTION 'Este convite atingiu o limite de inscrições'; END IF;
 IF nullif(trim(p_email),'') IS NULL THEN RAISE EXCEPTION 'Email obrigatório'; END IF;
 SELECT referral_code INTO v_ref FROM public.profiles WHERE id=v.created_by;
 IF v_ref IS NULL THEN RAISE EXCEPTION 'Convite indisponível'; END IF;
 UPDATE private.registration_links SET uses_count=uses_count+1 WHERE id=v.id;
 INSERT INTO private.registration_link_redemptions(user_id,link_id) VALUES(p_user,v.id);
 INSERT INTO private.registration_link_audit(link_id,actor_id,action) VALUES(v.id,p_user,'registered');
 RETURN v_ref;
END $function$
;

CREATE OR REPLACE FUNCTION private.admin_registration_links(p_link uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_actor uuid:=auth.uid(); result jsonb;
BEGIN
 IF v_actor IS NULL OR NOT public.admin_area_allowed('admin_campaigns') THEN RAISE EXCEPTION 'Só o administrador pode gerir convites.' USING ERRCODE='42501'; END IF;
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
END $function$
;

CREATE OR REPLACE FUNCTION public.issue_individual_invitation(p_email text, p_policy text DEFAULT 'email'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result json; token text;
BEGIN
 PERFORM private.invitation_require_admin();
 IF p_policy='admin_waiver' AND NOT public.has_role(auth.uid(),'admin') THEN
   RAISE EXCEPTION 'Sem permissão para convite de confiança' USING ERRCODE='42501';
 END IF;
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
END $function$
;

CREATE OR REPLACE FUNCTION private.trusted_admin_active(p_actor uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_actor and u.deleted_at is null
   and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
   and p.account_status='active'
   and integration_access_private.area_granted(u.id,'admin_trusted_invites'));
$function$
;

CREATE OR REPLACE FUNCTION public.can_issue_user_invitation(p_user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT p_user_id IS NOT NULL AND (
 integration_access_private.area_granted(p_user_id, 'admin_campaigns') OR EXISTS (SELECT 1 FROM public.invitation_permissions WHERE user_id = p_user_id));
$function$
;

CREATE OR REPLACE FUNCTION afroloc_experience_private.handle(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
 uid uuid:=auth.uid(); a public.afroloc_experience_addresses; result jsonb;
 prov public.afroloc_official_divisions; mun public.afroloc_official_divisions; com public.afroloc_official_divisions;
 lat double precision; lon double precision; compact text; generated text; request_id uuid; grid_size integer;
begin
 if uid is null then raise exception 'Sessão necessária.' using errcode='42501'; end if;
 -- Reject deleted/revoked sessions as well as anonymous accounts.
 if not exists(select 1 from auth.users where id=uid and coalesce(is_anonymous,false)=false) then raise exception 'Sessão inválida.' using errcode='42501'; end if;
 if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=uid) then raise exception 'Volte a entrar na Yamilook.' using errcode='42501'; end if;
 if not exists(select 1 from public.profiles where id=uid and upper(trim(country_code))='AO') then raise exception 'Seleccione Angola no seu perfil.' using errcode='42501'; end if;
 if p_action='catalog' then
  select coalesce(jsonb_agg(to_jsonb(d) order by d.level,d.name),'[]') into result from public.afroloc_official_divisions d;
  return jsonb_build_object('divisions',result);
 elsif p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into result from
   (select id,label,code,neighborhood,status,review_note,created_at,expires_at from public.afroloc_experience_addresses where owner_id=uid) x;
  return jsonb_build_object('addresses',result,'canReview',public.is_moderator_or_admin(uid));
 elsif p_action='queue' then
  if not public.is_moderator_or_admin(uid) then raise exception 'Sem permissão.' using errcode='42501'; end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from
   (select id,label,code,neighborhood,status,created_at,expires_at,owner_id=uid as is_own from public.afroloc_experience_addresses where status='pending' and expires_at>now() order by created_at limit 100) x;
  return jsonb_build_object('addresses',result);
 elsif p_action='create' then
  if (p_data->>'consent') is distinct from 'true' or coalesce(length(trim(p_data->>'label')),0) not between 1 and 120 or coalesce(length(trim(p_data->>'neighborhood')),0) not between 1 and 120 then raise exception 'Preencha o local e confirme a autorização.'; end if;
  request_id:=(p_data->>'id')::uuid;
  if request_id is null then raise exception 'Pedido inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into a from public.afroloc_experience_addresses where id=request_id;
  if found then
   if a.owner_id<>uid then raise exception 'Pedido indisponível.' using errcode='42501'; end if;
   return jsonb_build_object('ok',true,'id',a.id);
  end if;
  if not public.admin_area_allowed('admin_addresses') and (select count(*) from public.afroloc_experience_addresses where owner_id=uid and status<>'closed' and expires_at>now())>=3 then raise exception 'Pode manter até três endereços activos.'; end if;
  if not public.admin_area_allowed('admin_addresses') and (select count(*) from public.afroloc_experience_addresses where owner_id=uid and created_at>now()-interval '1 day')>=10 then raise exception 'Limite diário atingido.'; end if;
  select * into prov from public.afroloc_official_divisions where code=p_data->>'province' and level=1;
  select * into mun from public.afroloc_official_divisions where code=p_data->>'municipality' and level=2 and parent_code=prov.code;
  select * into com from public.afroloc_official_divisions where code=p_data->>'commune' and level=3 and parent_code=mun.code;
  if prov.code is null or mun.code is null then raise exception 'Seleccione divisões administrativas válidas.'; end if;
  if exists(select 1 from public.afroloc_official_divisions where level=3 and parent_code=mun.code) then
   if com.code is null then raise exception 'Seleccione a comuna.';end if;
  elsif nullif(p_data->>'commune','') is not null then raise exception 'Comuna inválida.';end if;
  lat:=(p_data->>'latitude')::double precision; lon:=(p_data->>'longitude')::double precision;
  if lat is null or lon is null or not(lat between -18.1 and -4.3 and lon between 11.3 and 24.1) then raise exception 'Indique uma localização em Angola.'; end if;
  -- Match the canonical AFROLOC automatic zone selection for Angola.
  grid_size:=case when exists(select 1 from (values (-8.839,13.289,0.25),(-12.575,13.405,0.08),(-12.345,16.876,0.08),(-12.769,15.735,0.1),(-5.557,12.189,0.08)) c(center_lat,center_lon,radius) where power(lat-c.center_lat,2)+power(lon-c.center_lon,2)<=power(c.radius,2)) then 10 else 25 end;
  compact:='AO-ZU-G'||grid_size||'-'||public.afroloc_b36_signed(floor(6378137.0*radians(lon)/grid_size)::bigint)||'-'||public.afroloc_b36_signed(floor(6378137.0*ln(tan(pi()/4+radians(lat)/2))/grid_size)::bigint);
  generated:='AO-'||left(regexp_replace(prov.code,'^.*-',''),3)||'-'||left(regexp_replace(mun.code,'^.*-',''),3)||'-'||coalesce(left(regexp_replace(com.code,'^.*-',''),3),'000')||'-DIG-'||substring(compact from 7);
  insert into public.afroloc_experience_addresses(id,owner_id,label,code,province_code,municipality_code,commune_code,neighborhood,latitude,longitude)
   values(request_id,uid,trim(p_data->>'label'),generated,prov.code,mun.code,coalesce(com.code,''),trim(p_data->>'neighborhood'),lat,lon);
  insert into afroloc_experience_private.audit(actor,action,address_id) values(uid,'create',request_id);
  return jsonb_build_object('ok',true,'id',request_id,'code',generated);
 end if;
 select * into a from public.afroloc_experience_addresses where id=(p_data->>'id')::uuid for update;
 if not found then raise exception 'Endereço indisponível.'; end if;
 if p_action='review' then
  if not public.is_moderator_or_admin(uid) or a.owner_id=uid or exists(select 1 from afroloc_experience_private.assignments r where r.address_id=a.id and r.creator=uid) then raise exception 'A revisão exige outro responsável autorizado.' using errcode='42501'; end if;
  if a.status<>'pending' or a.expires_at<=now() or coalesce(p_data->>'decision','') not in ('approved','rejected') or (p_data->>'confirmed') is distinct from 'true' or coalesce(length(trim(p_data->>'note')),0) not between 3 and 500 then raise exception 'Confirme a revisão e registe a fundamentação.'; end if;
  update public.afroloc_experience_addresses set status=p_data->>'decision',reviewer_id=uid,review_note=trim(p_data->>'note') where id=a.id;
 elsif a.owner_id<>uid then raise exception 'Sem permissão.' using errcode='42501';
 elsif p_action='close' then
  update public.afroloc_experience_addresses set status='closed' where id=a.id;
 elsif p_action='position' then
  if a.status='closed' or a.expires_at<=now() then raise exception 'Endereço encerrado ou expirado.'; end if;
  insert into afroloc_experience_private.audit(actor,action,address_id) values(uid,'position',a.id);
  return jsonb_build_object('code',a.code,'label',a.label,'point',jsonb_build_object('lat',a.latitude,'lon',a.longitude),'expiresAt',least(a.expires_at,now()+interval '30 seconds'));
 else raise exception 'Operação inválida.';
 end if;
 insert into afroloc_experience_private.audit(actor,action,address_id) values(uid,p_action,a.id);
 return jsonb_build_object('ok',true);
end $function$
;

CREATE OR REPLACE FUNCTION public.reserve_registration_place(p_code text, p_ticket uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE l private.registration_links%ROWTYPE; deadline timestamptz;
BEGIN
 SELECT * INTO l FROM private.registration_links WHERE code=upper(trim(p_code)) FOR UPDATE;
 IF NOT FOUND OR l.status<>'active' OR NOT integration_access_private.area_granted(l.created_by,'admin_campaigns') OR l.expires_at<=clock_timestamp() THEN
 RETURN json_build_object('valid',false,'error','Este convite já não está disponível.'); END IF;
 DELETE FROM private.registration_holds WHERE link_id=l.id AND expires_at<=clock_timestamp();
 SELECT expires_at INTO deadline FROM private.registration_holds WHERE ticket=p_ticket AND link_id=l.id;
 IF deadline IS NULL THEN
 IF private.registration_remaining(l)=0 THEN RETURN json_build_object('valid',false,'error','Já não há vagas disponíveis.'); END IF;
 deadline:=least(l.expires_at,clock_timestamp()+interval '15 minutes');
 INSERT INTO private.registration_holds VALUES(p_ticket,l.id,deadline);
 END IF;
 RETURN json_build_object('valid',true,'expires_at',deadline);
END $function$
;


-- Delegation applies to the precise tables/actions used by each manager.
alter policy "Admins can view all applications" on public.creator_applications
 using(public.admin_area_allowed('admin_creators'));
alter policy "Admins can update applications" on public.creator_applications
 using(public.admin_area_allowed('admin_creators')) with check(public.admin_area_allowed('admin_creators'));
alter policy "Admins read all creator docs" on storage.objects
 using(bucket_id='creator-documents' and public.admin_area_allowed('admin_creators'));
alter policy "Admins can view all payouts" on public.payout_requests
 using(public.admin_area_allowed('admin_payouts'));
-- Delegated payment operators use process_payout, which validates transitions and locks the request.
-- The pre-existing administrator UPDATE policy remains for existing administrative callers.
create policy delegated_certification_read on public.residence_declarations
 for select to authenticated using(public.admin_area_allowed('admin_certifications'));

create function integration_access_private.audit_creator_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status is distinct from new.status then
   insert into integration_access_private.audit(actor_id,feature,target_id,action,before_value,after_value)
   values(auth.uid(),'admin_creators',new.user_id,'creator_review',
     jsonb_build_object('applicationId',old.id,'status',old.status),
     jsonb_build_object('applicationId',new.id,'status',new.status));
 end if;
 return new;
end $$;
revoke all on function integration_access_private.audit_creator_review() from public,anon,authenticated;
create trigger audit_admin_creator_review after update of status on public.creator_applications
 for each row execute function integration_access_private.audit_creator_review();

-- The full deletion is one transaction. Both authentication and profile addresses must identify test accounts.
create function public.admin_clear_test_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare targets uuid[]; total integer;
begin
 if not public.admin_area_allowed('admin_test_data') then raise exception 'Sem permissão' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('admin-test-data',0));
 select coalesce(array_agg(u.id),'{}') into targets from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email) like '%@yamilook.test' and lower(p.email) like '%@yamilook.test';
 total:=cardinality(targets);
 delete from public.status_views where viewer_id=any(targets);
 delete from public.statuses where user_id=any(targets);
 delete from public.post_comments where user_id=any(targets);
 delete from public.post_likes where user_id=any(targets);
 delete from public.posts where user_id=any(targets);
 delete from public.messages where sender_id=any(targets);
 delete from public.conversation_participants where user_id=any(targets);
 delete from public.contacts where user_id=any(targets);
 insert into integration_access_private.audit(actor_id,feature,action,after_value)
 values(auth.uid(),'admin_test_data','test_data_cleared',jsonb_build_object('testAccounts',total));
 return jsonb_build_object('ok',true,'testAccounts',total);
end $$;
revoke all on function public.admin_clear_test_data() from public,anon;
grant execute on function public.admin_clear_test_data() to authenticated;
