
-- Independent phone possession evidence. Never modifies auth.users or profiles.
create table public.account_phone_challenges (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 phone text not null check(phone ~ '^\+[1-9][0-9]{7,14}$'), digest text not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '5 minutes',
 attempts int not null default 0, delivered boolean not null default false, consumed_at timestamptz
);
create index on public.account_phone_challenges(user_id,created_at);
create index on public.account_phone_challenges(phone,created_at);
create table public.account_verified_phones (
 user_id uuid primary key references auth.users(id) on delete cascade, phone text not null unique,
 verified_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '180 days',
 revoked_at timestamptz
);
create table public.account_security_events (
 id bigint generated always as identity primary key, user_id uuid not null,
 event text not null, created_at timestamptz not null default now()
);
alter table public.account_phone_challenges enable row level security;
alter table public.account_verified_phones enable row level security;
alter table public.account_security_events enable row level security;
revoke all on public.account_phone_challenges,public.account_verified_phones,public.account_security_events from public,anon,authenticated;
grant all on public.account_phone_challenges,public.account_verified_phones,public.account_security_events to service_role;
revoke all on sequence public.account_security_events_id_seq from public,anon,authenticated;
grant usage on sequence public.account_security_events_id_seq to service_role;

create function public.account_phone_action(p_actor uuid,p_action text,p_id uuid default null,p_phone text default null,p_digest text default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.account_phone_challenges; v public.account_verified_phones;
begin
 if p_actor is null then return jsonb_build_object('ok',false,'reason','unauthorized'); end if;
 perform pg_advisory_xact_lock(hashtextextended(p_actor::text,0));
 if p_action='status' then
  select * into v from public.account_verified_phones where user_id=p_actor;
  return jsonb_build_object('ok',true,'verified',v.user_id is not null and v.revoked_at is null and v.expires_at>now(),'expires_at',v.expires_at);
 elsif p_action='revoke' then
  update public.account_verified_phones set revoked_at=now() where user_id=p_actor;
  update public.account_phone_challenges set consumed_at=now() where user_id=p_actor and consumed_at is null;
  insert into public.account_security_events(user_id,event) values(p_actor,'phone_revoked');
  return jsonb_build_object('ok',true);
 elsif p_action='begin' then
  if p_id is null or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_digest is null or length(p_digest)<>64 then
   return jsonb_build_object('ok',false,'reason','invalid_request');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_phone,1));
  if exists(select 1 from public.account_phone_challenges where user_id=p_actor and created_at>now()-interval '60 seconds')
   or (select count(*) from public.account_phone_challenges where user_id=p_actor and created_at>now()-interval '1 hour')>=5
   or (select count(*) from public.account_phone_challenges where phone=p_phone and created_at>now()-interval '1 hour')>=5 then
    return jsonb_build_object('ok',false,'reason','try_later');
  end if;
  update public.account_phone_challenges set consumed_at=now() where user_id=p_actor and consumed_at is null;
  insert into public.account_phone_challenges(id,user_id,phone,digest) values(p_id,p_actor,p_phone,p_digest);
  insert into public.account_security_events(user_id,event) values(p_actor,'phone_challenge_started');
  return jsonb_build_object('ok',true,'challenge_id',p_id);
 end if;
 select * into c from public.account_phone_challenges where id=p_id and user_id=p_actor for update;
 if not found or c.consumed_at is not null or c.expires_at<=now() then return jsonb_build_object('ok',false,'reason','invalid_challenge'); end if;
 if p_action='delivered' then
  update public.account_phone_challenges set delivered=true where id=c.id;
  return jsonb_build_object('ok',true);
 elsif p_action='cancel' then
  update public.account_phone_challenges set consumed_at=now() where id=c.id;
  return jsonb_build_object('ok',true);
 elsif p_action='verify' then
  if not c.delivered or c.attempts>=5 then return jsonb_build_object('ok',false,'reason','invalid_challenge'); end if;
  update public.account_phone_challenges set attempts=attempts+1 where id=c.id;
  if p_digest is null or c.digest<>p_digest then return jsonb_build_object('ok',false,'reason','invalid_challenge'); end if;
  perform pg_advisory_xact_lock(hashtextextended(c.phone,1));
  -- No takeover/merge even for a recycled number: recovery requires separate review.
  if exists(select 1 from public.account_verified_phones where phone=c.phone and user_id<>p_actor) then
   update public.account_phone_challenges set consumed_at=now() where id=c.id;
   return jsonb_build_object('ok',false,'reason','verification_failed');
  end if;
  update public.account_phone_challenges set consumed_at=now() where id=c.id;
  insert into public.account_verified_phones(user_id,phone) values(p_actor,c.phone)
   on conflict(user_id) do update set phone=excluded.phone,verified_at=now(),expires_at=now()+interval '180 days',revoked_at=null;
  insert into public.account_security_events(user_id,event) values(p_actor,'phone_verified');
  return jsonb_build_object('ok',true,'verified',true);
 end if;
 return jsonb_build_object('ok',false,'reason','invalid_request');
end $$;
revoke all on function public.account_phone_action(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.account_phone_action(uuid,text,uuid,text,text) to service_role;

create table public.afroloc_link_requests (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 code text not null,verifier text,created_at timestamptz not null default now(), linked_at timestamptz,revoked_at timestamptz
);
alter table public.afroloc_link_requests enable row level security;
revoke all on public.afroloc_link_requests from public,anon,authenticated;
grant all on public.afroloc_link_requests to service_role;
create index on public.afroloc_link_requests(user_id,created_at);
