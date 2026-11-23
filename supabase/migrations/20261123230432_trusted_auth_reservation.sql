begin;

-- GoTrue v2.198.0 INSERTs the user before applying custom app_metadata and
-- confirmation flags. Admission proof must therefore live in a private,
-- service-owned reservation, bound to the UUID and internal alias on INSERT.
alter table private.trusted_invitations
  add column activation_user_id uuid unique,
  add column activation_identifier text unique,
  add column activation_username text,
  add column activation_recovery_hash text,
  add column activation_otp_id uuid,
  add constraint trusted_activation_reservation_complete check (
    (activation_user_id is null and activation_identifier is null and activation_username is null
      and activation_recovery_hash is null and activation_otp_id is null)
    or (activation_user_id is not null and activation_identifier is not null and activation_username is not null
      and activation_recovery_hash is not null
      and activation_identifier ~ '^[a-f0-9]{32}@trusted-login\.yamilook\.invalid$'
      and activation_username ~ '^[a-z0-9][a-z0-9_]{2,19}$'
      and activation_recovery_hash ~ '^[a-f0-9]{64}$'
      and ((mode='direct' and activation_otp_id is null) or (mode='phone' and activation_otp_id is not null)))
  );

create or replace function private.trusted_invitations_service(p_action text,p_actor uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 i private.trusted_invitations%rowtype;
 a private.trusted_accounts%rowtype;
 n integer; ttl integer; stamp timestamptz:=clock_timestamp();
 uid uuid; identifier text; result jsonb; session_row record;
begin
 if p_action='rate' then
   if coalesce(p_input->>'key','') !~ '^[a-f0-9]{64}$' then return private.trusted_error('invalid_request'); end if;
   ttl:=(p_input->>'window_seconds')::integer; n:=(p_input->>'limit')::integer;
   if ttl not between 1 and 86400 or n not between 1 and 500 then return private.trusted_error('invalid_request'); end if;
   insert into private.trusted_invitation_limits(key,window_at,attempts) values(p_input->>'key',stamp,1)
   on conflict(key) do update set
     attempts=case when trusted_invitation_limits.window_at <= stamp-make_interval(secs=>ttl) then 1 else trusted_invitation_limits.attempts+1 end,
     window_at=case when trusted_invitation_limits.window_at <= stamp-make_interval(secs=>ttl) then stamp else trusted_invitation_limits.window_at end
   returning attempts into n;
   delete from private.trusted_invitation_limits where key in (
     select key from private.trusted_invitation_limits where window_at<stamp-interval '24 hours'
     order by window_at limit 50 for update skip locked
   );
   return jsonb_build_object('ok',n<=(p_input->>'limit')::integer);
 end if;

 if p_action in ('status','issue','list','revoke') then
   if not private.trusted_admin_active(p_actor) then return private.trusted_error('forbidden'); end if;
   if not exists(select 1 from auth.sessions where id=(p_input->>'session_id')::uuid and user_id=p_actor) then
     return private.trusted_error('unauthorized');
   end if;
   if p_action='status' then return jsonb_build_object('ok',true); end if;
   if p_action='list' then
     select coalesce(jsonb_agg(private.trusted_invitation_json(x) order by x.created_at desc),'[]'::jsonb) into result
       from (select * from private.trusted_invitations order by created_at desc limit 100) x;
     return jsonb_build_object('ok',true,'invitations',result);
   end if;
   if p_action='issue' then
     ttl:=coalesce((p_input->>'expires_hours')::integer,72);
     if ttl not between 1 and 168 or coalesce(p_input->>'token_hash','') !~ '^[a-f0-9]{64}$'
       or coalesce(p_input->>'mode','') not in ('direct','phone')
       or char_length(trim(coalesce(p_input->>'recipient_name',''))) not between 2 and 100
       or coalesce(p_input->>'language','pt') not in ('pt','en','fr','ar','am','sw','ln','yo','sn','zu','kmb','umb','kik')
       or ((p_input->>'mode')='phone' and coalesce(p_input->>'phone','') !~ '^\+[1-9][0-9]{7,14}$') then
       return private.trusted_error('invalid_request');
     end if;
     if p_input->>'mode'='phone' and exists(select 1 from auth.users where phone=ltrim(p_input->>'phone','+') and deleted_at is null) then
       return private.trusted_error('phone_unavailable');
     end if;
     insert into private.trusted_invitations(token_hash,created_by,recipient_name,mode,phone,language,created_at,expires_at)
     values(p_input->>'token_hash',p_actor,trim(p_input->>'recipient_name'),p_input->>'mode',
       case when p_input->>'mode'='phone' then p_input->>'phone' end,coalesce(p_input->>'language','pt'),stamp,stamp+make_interval(hours=>ttl)) returning * into i;
     insert into private.trusted_invitation_audit(invitation_id,actor_id,action) values(i.id,p_actor,'issued');
     return jsonb_build_object('ok',true,'invitation',private.trusted_invitation_json(i));
   end if;
   select * into i from private.trusted_invitations where id=(p_input->>'id')::uuid for update;
   if not found then return private.trusted_error('invalid_invitation'); end if;
   if i.used_at is not null then return private.trusted_error('already_used'); end if;
   if i.revoked_at is null then
     update private.trusted_invitations set revoked_at=stamp,otp_hash=null,activation_claim_hash=null,
       activation_expires_at=null,activation_user_id=null,activation_identifier=null,activation_username=null,
       activation_recovery_hash=null,activation_otp_id=null where id=i.id returning * into i;
     insert into private.trusted_invitation_audit(invitation_id,actor_id,action) values(i.id,p_actor,'revoked');
   end if;
   return jsonb_build_object('ok',true,'invitation',private.trusted_invitation_json(i));
 end if;

 if p_action='login_audit' then
   select * into a from private.trusted_accounts where user_id=(p_input->>'user_id')::uuid;
   insert into private.trusted_invitation_audit(invitation_id,actor_id,action)
     values(a.invitation_id,a.user_id,case when (p_input->>'success')::boolean then 'login_succeeded' else 'login_failed' end);
   return jsonb_build_object('ok',true);
 end if;

 if p_action in ('login_lookup','recover') then
   select u.id,u.email into uid,identifier from private.trusted_accounts ta
     join auth.users u on u.id=ta.user_id join public.profiles p on p.id=u.id
     where lower(btrim(p.username))=lower(btrim(p_input->>'username')) and p.account_status='active' and u.deleted_at is null and not coalesce(u.is_anonymous,false)
       and (u.banned_until is null or u.banned_until<=stamp)
       and u.raw_app_meta_data->>'trusted_account'='true';
   if p_action='login_lookup' then
     return jsonb_build_object('ok',true,'user_id',uid,'identifier',identifier);
   end if;
   if uid is null then return private.trusted_error('invalid_recovery'); end if;
   select * into a from private.trusted_accounts where user_id=uid for update;
   if a.recovery_hash is distinct from p_input->>'recovery_hash' then return private.trusted_error('invalid_recovery'); end if;
   if coalesce(p_input->>'next_recovery_hash','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_input->>'password_hash','') !~ '^\$2[aby]\$1[02]\$[./A-Za-z0-9]{53}$' then
     return private.trusted_error('invalid_request');
   end if;
   -- Native Auth bcrypt hash; only a newly-created trusted account can reach this
   -- operation. Rotation, password update and refresh-session revocation commit together.
   update auth.users set encrypted_password=p_input->>'password_hash',updated_at=stamp,
     confirmation_token='',confirmation_sent_at=null,recovery_token='',recovery_sent_at=null,
     email_change_token_current='',email_change_token_new='',email_change_sent_at=null,
     phone_change_token='',phone_change_sent_at=null,reauthentication_token='',reauthentication_sent_at=null
     where id=uid and deleted_at is null and not coalesce(is_anonymous,false)
       and raw_app_meta_data->>'trusted_account'='true' and (banned_until is null or banned_until<=stamp)
       and exists(select 1 from public.profiles where id=uid and account_status='active');
   if not found then return private.trusted_error('invalid_recovery'); end if;
   delete from auth.one_time_tokens where user_id=uid;
   update private.trusted_accounts set recovery_hash=p_input->>'next_recovery_hash',recovered_at=stamp where user_id=uid;
   for session_row in delete from auth.sessions where user_id=uid returning id loop
     insert into public.account_session_revocations(user_id,session_id) values(uid,session_row.id);
   end loop;
   -- Current GoTrue refresh tokens reference sessions; remove any residual tokens
   -- belonging to this same account, including earlier schema/session variants.
   delete from auth.refresh_tokens where user_id=uid::text;
   insert into private.trusted_invitation_audit(invitation_id,actor_id,action) values(a.invitation_id,uid,'recovered');
   return jsonb_build_object('ok',true);
 end if;

 if p_action='activation_result' then
   select * into i from private.trusted_invitations where activation_claim_hash=p_input->>'claim_hash';
   if i.used_by=i.activation_user_id and i.activation_user_id::text=p_input->>'user_id'
     and i.activation_identifier=p_input->>'identifier' and i.activation_recovery_hash=p_input->>'recovery_hash'
     and exists(select 1 from private.trusted_accounts ta join auth.users u on u.id=ta.user_id
       where ta.user_id=i.used_by and ta.invitation_id=i.id and ta.recovery_hash=p_input->>'recovery_hash'
         and u.email=i.activation_identifier and u.raw_app_meta_data->>'trusted_account'='true') then
     return jsonb_build_object('ok',true,'user_id',i.used_by);
   end if;
   return private.trusted_error('invalid_invitation');
 end if;

 -- Releasing a failed native request must never erase a committed activation.
 -- It may clear an expired/revoked reservation, but only the exact server proof.
 if p_action='release_activation' then
   select * into i from private.trusted_invitations where token_hash=p_input->>'token_hash' for update;
   if not found or i.activation_claim_hash is distinct from p_input->>'claim_hash'
     or i.activation_user_id::text is distinct from p_input->>'user_id'
     or i.activation_identifier is distinct from p_input->>'identifier'
     or i.activation_recovery_hash is distinct from p_input->>'recovery_hash' then
     return private.trusted_error('invalid_invitation');
   end if;
   if i.used_at is null then
     update private.trusted_invitations set activation_claim_hash=null,activation_expires_at=null,
       activation_user_id=null,activation_identifier=null,activation_username=null,
       activation_recovery_hash=null,activation_otp_id=null where id=i.id;
   end if;
   return jsonb_build_object('ok',true);
 end if;

 select * into i from private.trusted_invitations where token_hash=p_input->>'token_hash' for update;
 stamp:=clock_timestamp();
 if not found or i.used_at is not null or i.revoked_at is not null or i.expires_at<=stamp
   or not private.trusted_admin_active(i.created_by) then return private.trusted_error('invalid_invitation'); end if;
 if p_action='preview' then
   return jsonb_build_object('ok',true,'invitation',private.trusted_invitation_json(i));
 elsif p_action='activation_context' then
   return jsonb_build_object('ok',true,'mode',i.mode,'otp_id',i.otp_id);
 elsif p_action='request_otp' then
   if i.mode<>'phone' then return private.trusted_error('invalid_request'); end if;
   if i.otp_sent_at>stamp-interval '60 seconds' then return private.trusted_error('rate_limited'); end if;
   if i.otp_window_at>stamp-interval '1 hour' and i.otp_requests>=5 then return private.trusted_error('rate_limited'); end if;
   update private.trusted_invitations set otp_id=(p_input->>'otp_id')::uuid,otp_hash=p_input->>'otp_hash',
     otp_expires_at=least(expires_at,stamp+interval '5 minutes'),otp_sent_at=stamp,otp_attempts=0,otp_accepted=false,
     otp_requests=case when otp_window_at>stamp-interval '1 hour' then otp_requests+1 else 1 end,
     otp_window_at=case when otp_window_at>stamp-interval '1 hour' then otp_window_at else stamp end
     where id=i.id;
   insert into private.trusted_invitation_audit(invitation_id,action) values(i.id,'otp_requested');
   return jsonb_build_object('ok',true,'phone',i.phone,'language',i.language);
 elsif p_action='otp_delivery' then
   update private.trusted_invitations set otp_accepted=coalesce((p_input->>'accepted')::boolean,false)
     where id=i.id and otp_id=(p_input->>'otp_id')::uuid;
   return jsonb_build_object('ok',true);
 elsif p_action='prepare_activation' then
   if coalesce(p_input->>'user_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
     or coalesce(p_input->>'identifier','') !~ '^[a-f0-9]{32}@trusted-login\.yamilook\.invalid$'
     or coalesce(p_input->>'recovery_hash','') !~ '^[a-f0-9]{64}$'
     or coalesce(p_input->>'claim_hash','') !~ '^[a-f0-9]{64}$' then
     return private.trusted_error('invalid_request');
   end if;
   uid:=(p_input->>'user_id')::uuid;
   if uid='00000000-0000-0000-0000-000000000000'::uuid
     or exists(select 1 from auth.users where id=uid or lower(email)=p_input->>'identifier') then
     return private.trusted_error('invalid_request');
   end if;
   if coalesce(p_input->>'username','') !~ '^[a-z0-9][a-z0-9_]{2,19}$' then return private.trusted_error('invalid_username'); end if;
   if exists(select 1 from public.profiles where lower(btrim(username))=lower(btrim(p_input->>'username'))) then return private.trusted_error('username_unavailable'); end if;
   if i.activation_claim_hash is not null and i.activation_expires_at>stamp then return private.trusted_error('activation_busy'); end if;
   if i.mode='phone' then
     if not i.otp_accepted or i.otp_hash is null or i.otp_id is null or i.otp_expires_at is null
       or i.otp_expires_at<=stamp or i.otp_attempts>=5 then
       return private.trusted_error('invalid_otp');
     end if;
     update private.trusted_invitations set otp_attempts=otp_attempts+1 where id=i.id;
     if i.otp_hash is distinct from p_input->>'otp_hash' or i.otp_id::text is distinct from p_input->>'otp_id' then
       return private.trusted_error('invalid_otp');
     end if;
     if exists(select 1 from auth.users where phone=ltrim(i.phone,'+') and deleted_at is null) then
       return private.trusted_error('phone_unavailable');
     end if;
   end if;
   update private.trusted_invitations set activation_claim_hash=p_input->>'claim_hash',
     activation_expires_at=least(expires_at,stamp+interval '2 minutes'),activation_user_id=uid,
     activation_identifier=p_input->>'identifier',activation_username=p_input->>'username',
     activation_recovery_hash=p_input->>'recovery_hash',activation_otp_id=case when i.mode='phone' then i.otp_id end
     where id=i.id;
   return jsonb_build_object('ok',true,'phone',i.phone,'mode',i.mode,'language',i.language);
 end if;
 return private.trusted_error('invalid_request');
end;
$$;

create or replace function private.trusted_signup_prepare() returns trigger
language plpgsql security definer set search_path='' as $$
declare i private.trusted_invitations%rowtype; ref text; stamp timestamptz:=clock_timestamp();
begin
 select * into i from private.trusted_invitations where activation_user_id=NEW.id for update;
 stamp:=clock_timestamp();
 if not found then
   if lower(coalesce(NEW.email,'')) not like '%@trusted-login.yamilook.invalid'
     and NEW.raw_app_meta_data->>'trusted_signup_version' is distinct from '1'
     and NEW.raw_app_meta_data->>'trusted_account' is distinct from 'true' then return NEW; end if;
   raise exception 'TRUSTED_INVITE_INVALID';
 end if;
 if i.activation_identifier is distinct from NEW.email
   or coalesce(NEW.email,'') !~ '^[a-f0-9]{32}@trusted-login\.yamilook\.invalid$'
   or i.activation_claim_hash is null or i.activation_expires_at is null or i.activation_expires_at<=stamp
   or i.activation_recovery_hash is null or i.used_at is not null or i.revoked_at is not null or i.expires_at<=stamp
   or not private.trusted_admin_active(i.created_by) then raise exception 'TRUSTED_INVITE_INVALID'; end if;
 if NEW.raw_user_meta_data->>'username' is distinct from i.activation_username
   or coalesce(NEW.raw_user_meta_data->>'username','') !~ '^[a-z0-9][a-z0-9_]{2,19}$'
   or char_length(trim(coalesce(NEW.raw_user_meta_data->>'display_name',''))) not between 2 and 100 then
   raise exception 'TRUSTED_PROFILE_INVALID';
 end if;
 if i.mode='phone' then
   if not i.otp_accepted or i.otp_expires_at is null or i.otp_expires_at<=stamp or i.otp_hash is null
     or i.activation_otp_id is distinct from i.otp_id
     or ltrim(coalesce(NEW.phone,''),'+')<>ltrim(i.phone,'+') then raise exception 'TRUSTED_PHONE_INVALID'; end if;
 elsif nullif(NEW.phone,'') is not null or NEW.phone_confirmed_at is not null then
   raise exception 'TRUSTED_PHONE_INVALID';
 end if;
 select referral_code into ref from public.profiles where id=i.created_by;
 if ref is null then raise exception 'TRUSTED_INVITE_INVALID'; end if;

 -- Only after validating the reserved identity and optional phone proof may
 -- the internal login identifier be confirmed. No real mailbox is verified.
 NEW.email_confirmed_at:=stamp;
 if i.mode='phone' then NEW.phone_confirmed_at:=stamp; end if;
 update private.trusted_invitations set used_at=stamp,used_by=NEW.id,otp_hash=null,otp_id=null where id=i.id;
 insert into private.trusted_accounts(user_id,invitation_id,recovery_hash) values(NEW.id,i.id,i.activation_recovery_hash);
 insert into private.trusted_invitation_audit(invitation_id,actor_id,action) values(i.id,NEW.id,'activated');
 NEW.raw_app_meta_data:=(coalesce(NEW.raw_app_meta_data,'{}'::jsonb)-'trusted_signup_version'-'trusted_claim_hash'-'trusted_recovery_hash')
   ||jsonb_build_object('trusted_account',true,'trusted_invitation_id',i.id,'trusted_invitation_mode',i.mode,
     'access_approved_by',i.created_by,'access_approved_at',i.created_at,'contact_email_verified',false);
 NEW.raw_user_meta_data:=coalesce(NEW.raw_user_meta_data,'{}'::jsonb)
   ||jsonb_build_object('ref',ref,'access_code',ref,'registration_email_language',i.language);
 return NEW;
end;
$$;
revoke all on function private.trusted_signup_prepare(),private.trusted_invitations_service(text,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function private.trusted_invitations_service(text,uuid,jsonb) to service_role;

commit;
