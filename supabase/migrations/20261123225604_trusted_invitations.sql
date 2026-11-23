begin;

-- A trusted invitation approves admission. It never verifies a real email address.
-- Only the Edge Function's service role can read tokens, phone challenges or recovery hashes.
create schema if not exists private;
create table private.trusted_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references auth.users(id),
  recipient_name text not null check (char_length(recipient_name) between 2 and 100),
  mode text not null check (mode in ('direct','phone')),
  phone text,
  language text not null default 'pt',
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  used_at timestamptz,
  used_by uuid,
  otp_id uuid,
  otp_hash text,
  otp_expires_at timestamptz,
  otp_sent_at timestamptz,
  otp_accepted boolean not null default false,
  otp_attempts integer not null default 0,
  otp_window_at timestamptz,
  otp_requests integer not null default 0,
  activation_claim_hash text unique,
  activation_expires_at timestamptz,
  check ((mode='phone' and phone ~ '^\+[1-9][0-9]{7,14}$') or (mode='direct' and phone is null)),
  check (expires_at > created_at and expires_at <= created_at + interval '7 days'),
  check ((used_at is null) = (used_by is null))
);
create index trusted_invitations_created_idx on private.trusted_invitations(created_at desc);
create table private.trusted_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade deferrable initially deferred,
  invitation_id uuid not null unique references private.trusted_invitations(id),
  recovery_hash text not null check (recovery_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  recovered_at timestamptz
);
create table private.trusted_invitation_audit (
  id bigint generated always as identity primary key,
  invitation_id uuid references private.trusted_invitations(id),
  actor_id uuid,
  action text not null,
  created_at timestamptz not null default clock_timestamp()
);
create table private.trusted_invitation_limits (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  window_at timestamptz not null,
  attempts integer not null
);
create index trusted_invitation_limits_window_idx on private.trusted_invitation_limits(window_at);
alter table private.trusted_invitations enable row level security;
alter table private.trusted_accounts enable row level security;
alter table private.trusted_invitation_audit enable row level security;
alter table private.trusted_invitation_limits enable row level security;
revoke all on private.trusted_invitations,private.trusted_accounts,private.trusted_invitation_audit,private.trusted_invitation_limits from public,anon,authenticated;

create function private.trusted_admin_active(p_actor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u join public.profiles p on p.id=u.id where u.id=p_actor and u.deleted_at is null
   and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
   and p.account_status='active'
   and public.has_role(u.id,'admin'));
$$;
create function private.trusted_invitation_json(i private.trusted_invitations) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('id',i.id,'recipient_name',i.recipient_name,'mode',i.mode,
   'language',i.language,'created_at',i.created_at,'expires_at',i.expires_at,
   'used_at',i.used_at,'revoked_at',i.revoked_at,
   'inviter_name',(select p.display_name from public.profiles p where p.id=i.created_by),
   'masked_phone',case when i.phone is not null then left(i.phone,4)||' ••• ••'||right(i.phone,3) end,
   'status',case when i.used_at is not null then 'used' when i.revoked_at is not null then 'revoked'
     when i.expires_at<=now() then 'expired' else 'pending' end);
$$;
create function private.trusted_error(p_code text) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('ok',false,'error',jsonb_build_object('code',p_code));
$$;

-- Service-only entry point. The authenticated actor and signed session ID are
-- resolved by getUser in the Edge Function; clients cannot invoke this RPC.
create function private.trusted_invitations_service(p_action text,p_actor uuid,p_input jsonb)
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
     update private.trusted_invitations set revoked_at=stamp,otp_hash=null,activation_claim_hash=null where id=i.id returning * into i;
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
     recovery_token='',recovery_sent_at=null,reauthentication_token='',reauthentication_sent_at=null
     where id=uid and deleted_at is null and not coalesce(is_anonymous,false)
       and raw_app_meta_data->>'trusted_account'='true' and (banned_until is null or banned_until<=stamp)
       and exists(select 1 from public.profiles where id=uid and account_status='active');
   if not found then return private.trusted_error('invalid_recovery'); end if;
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
   if i.used_by is not null and exists(select 1 from private.trusted_accounts ta join auth.users u on u.id=ta.user_id
       where ta.user_id=i.used_by and ta.recovery_hash=p_input->>'recovery_hash' and u.email=p_input->>'identifier') then
     return jsonb_build_object('ok',true,'user_id',i.used_by);
   end if;
   return private.trusted_error('invalid_invitation');
 end if;

 select * into i from private.trusted_invitations where token_hash=p_input->>'token_hash' for update;
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
   if coalesce(p_input->>'username','') !~ '^[a-z0-9][a-z0-9_]{2,19}$' then return private.trusted_error('invalid_username'); end if;
   if exists(select 1 from public.profiles where lower(btrim(username))=lower(btrim(p_input->>'username'))) then return private.trusted_error('username_unavailable'); end if;
   if i.activation_claim_hash is not null and i.activation_expires_at>stamp then return private.trusted_error('activation_busy'); end if;
   if i.mode='phone' then
     if not i.otp_accepted or i.otp_hash is null or i.otp_expires_at<=stamp or i.otp_attempts>=5 then
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
   if coalesce(p_input->>'claim_hash','') !~ '^[a-f0-9]{64}$' then return private.trusted_error('invalid_request'); end if;
   update private.trusted_invitations set activation_claim_hash=p_input->>'claim_hash',
     activation_expires_at=least(expires_at,stamp+interval '2 minutes') where id=i.id;
   return jsonb_build_object('ok',true,'phone',i.phone,'mode',i.mode);
 elsif p_action='release_activation' then
   update private.trusted_invitations set activation_claim_hash=null,activation_expires_at=null
     where id=i.id and activation_claim_hash=p_input->>'claim_hash';
   return jsonb_build_object('ok',true);
 end if;
 return private.trusted_error('invalid_request');
end;
$$;

create function public.trusted_invitations_service(p_action text,p_actor uuid default null,p_input jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.trusted_invitations_service(p_action,p_actor,p_input);
$$;
revoke all on function public.trusted_invitations_service(text,uuid,jsonb) from public,anon,authenticated;
revoke all on function private.trusted_invitations_service(text,uuid,jsonb),private.trusted_admin_active(uuid),
 private.trusted_invitation_json(private.trusted_invitations),private.trusted_error(text) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function public.trusted_invitations_service(text,uuid,jsonb),private.trusted_invitations_service(text,uuid,jsonb) to service_role;

create function private.trusted_signup_prepare() returns trigger
language plpgsql security definer set search_path='' as $$
declare i private.trusted_invitations%rowtype; ref text; claim text; recovery text;
begin
 if NEW.raw_app_meta_data->>'trusted_signup_version' is distinct from '1'
   and lower(coalesce(NEW.email,'')) not like '%@trusted-login.yamilook.invalid' then return NEW; end if;
 if NEW.raw_app_meta_data->>'trusted_signup_version' is distinct from '1'
   or coalesce(NEW.email,'') !~ '^[a-f0-9]{32}@trusted-login\.yamilook\.invalid$'
   or NEW.email_confirmed_at is null then raise exception 'TRUSTED_INVITE_INVALID'; end if;
 claim:=NEW.raw_app_meta_data->>'trusted_claim_hash'; recovery:=NEW.raw_app_meta_data->>'trusted_recovery_hash';
 if coalesce(claim,'') !~ '^[a-f0-9]{64}$' or coalesce(recovery,'') !~ '^[a-f0-9]{64}$' then
   raise exception 'TRUSTED_INVITE_INVALID';
 end if;
 select * into i from private.trusted_invitations where activation_claim_hash=claim for update;
 if not found or i.used_at is not null or i.revoked_at is not null or i.expires_at<=clock_timestamp()
   or i.activation_expires_at<=clock_timestamp() or not private.trusted_admin_active(i.created_by) then
   raise exception 'TRUSTED_INVITE_INVALID';
 end if;
 if coalesce(NEW.raw_user_meta_data->>'username','') !~ '^[a-z0-9][a-z0-9_]{2,19}$'
   or char_length(trim(coalesce(NEW.raw_user_meta_data->>'display_name',''))) not between 2 and 100 then
   raise exception 'TRUSTED_PROFILE_INVALID';
 end if;
 if i.mode='phone' then
   if not i.otp_accepted or i.otp_expires_at<=clock_timestamp() or NEW.phone_confirmed_at is null
     or ltrim(coalesce(NEW.phone,''),'+')<>ltrim(i.phone,'+') then raise exception 'TRUSTED_PHONE_INVALID'; end if;
 elsif nullif(NEW.phone,'') is not null or NEW.phone_confirmed_at is not null then
   raise exception 'TRUSTED_PHONE_INVALID';
 end if;
 select referral_code into ref from public.profiles where id=i.created_by;
 if ref is null then raise exception 'TRUSTED_INVITE_INVALID'; end if;
 update private.trusted_invitations set used_at=clock_timestamp(),used_by=NEW.id,otp_hash=null,otp_id=null where id=i.id;
 insert into private.trusted_accounts(user_id,invitation_id,recovery_hash) values(NEW.id,i.id,recovery);
 insert into private.trusted_invitation_audit(invitation_id,actor_id,action) values(i.id,NEW.id,'activated');
 NEW.raw_app_meta_data:=(coalesce(NEW.raw_app_meta_data,'{}'::jsonb)-'trusted_signup_version'-'trusted_claim_hash'-'trusted_recovery_hash')
   ||jsonb_build_object('trusted_account',true,'trusted_invitation_id',i.id,'trusted_invitation_mode',i.mode,
     'access_approved_by',i.created_by,'access_approved_at',i.created_at,'contact_email_verified',false);
 NEW.raw_user_meta_data:=coalesce(NEW.raw_user_meta_data,'{}'::jsonb)
   ||jsonb_build_object('ref',ref,'access_code',ref,'registration_email_language',i.language);
 return NEW;
end;
$$;
create function private.trusted_signup_finish() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.trusted_accounts where user_id=NEW.id) then
   update public.profiles set email=null where id=NEW.id;
 end if;
 return NEW;
end;
$$;
revoke all on function private.trusted_signup_prepare(),private.trusted_signup_finish() from public,anon,authenticated;
create trigger aa_trusted_signup_prepare before insert on auth.users for each row execute function private.trusted_signup_prepare();
create trigger zzz_trusted_signup_finish after insert on auth.users for each row execute function private.trusted_signup_finish();

commit;
