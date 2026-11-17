-- New requests only: do not send a campaign to historical pending requests.
alter table public.user_settings add column if not exists friend_request_emails boolean not null default true;
create schema if not exists private;
create table private.friend_mail_config (
 singleton boolean primary key default true check(singleton), token text not null
);
alter table private.friend_mail_config enable row level security;
revoke all on private.friend_mail_config from public, anon, authenticated;
insert into private.friend_mail_config values(true,gen_random_uuid()::text||gen_random_uuid()::text);

create table private.friend_mail_outbox (
 request_id uuid primary key, sender_id uuid not null references auth.users(id) on delete cascade,
 receiver_id uuid not null references auth.users(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','sent','skipped','failed')),
 attempts integer not null default 0, created_at timestamptz not null default now(),
 next_attempt_at timestamptz not null default now(), sent_at timestamptz,
 payload jsonb, provider_id text, last_error text
);
alter table private.friend_mail_outbox enable row level security;
revoke all on private.friend_mail_outbox from public,anon,authenticated;
create index friend_mail_due on private.friend_mail_outbox(next_attempt_at) where state='pending';
create index friend_mail_sender on private.friend_mail_outbox(sender_id,created_at);

-- Prevent forged acceptance and changes to the people named in a request.
create function private.guard_friend_request() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.sender_id<>old.sender_id or new.receiver_id<>old.receiver_id or new.id<>old.id or new.created_at<>old.created_at) then
  raise exception 'friend_request_identity_immutable';
 end if;
 if tg_op='INSERT' and (new.sender_id=new.receiver_id or new.status is distinct from 'pending'::public.friend_request_status) then
  raise exception 'friend_request_must_start_pending';
 end if;
 return new;
end $$;
create trigger guard_friend_request before insert or update on public.friend_requests for each row execute function private.guard_friend_request();
drop policy if exists "Users can update friend requests they receive" on public.friend_requests;
create policy "Users can update friend requests they receive" on public.friend_requests for update to authenticated
 using ((select auth.uid())=receiver_id) with check ((select auth.uid())=receiver_id and status in ('accepted','rejected','blocked'));

-- Invoker permissions retain the existing contact policies; the transaction is atomic.
create function public.respond_friend_request(p_request_id uuid,p_accept boolean) returns void
 language plpgsql security invoker set search_path='' as $$
declare r public.friend_requests; desired public.friend_request_status;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 select * into r from public.friend_requests where id=p_request_id for update;
 if not found or r.receiver_id<>auth.uid() then raise exception 'request_unavailable'; end if;
 desired:=case when p_accept then 'accepted'::public.friend_request_status else 'rejected'::public.friend_request_status end;
 if r.status=desired then return; end if;
 if r.status<>'pending' then raise exception 'request_already_answered'; end if;
 if p_accept then
  if exists(select 1 from public.contacts where user_id=auth.uid() and contact_user_id=r.sender_id and is_blocked) then raise exception 'contact_blocked'; end if;
  -- Plain INSERT does not require SELECT access to the other person's contact row.
  -- Catch only duplicate rows; every other failure rolls back the whole response.
  begin
   insert into public.contacts(user_id,contact_user_id) values(r.receiver_id,r.sender_id);
  exception when unique_violation then null; end;
  begin
   insert into public.contacts(user_id,contact_user_id) values(r.sender_id,r.receiver_id);
  exception when unique_violation then null; end;
 end if;
 update public.friend_requests set status=desired where id=r.id;
end $$;
revoke all on function public.respond_friend_request(uuid,boolean) from public,anon;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;

create function private.enqueue_friend_mail() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status<>'pending' then return new; end if;
 -- Serialize per sender so simultaneous requests cannot bypass the mail quota.
 perform pg_advisory_xact_lock(hashtextextended(new.sender_id::text,0));
 if (select count(*) from private.friend_mail_outbox where sender_id=new.sender_id and created_at>now()-interval '1 hour')>=20 then return new; end if;
 if exists(select 1 from private.friend_mail_outbox where sender_id=new.sender_id and receiver_id=new.receiver_id and created_at>now()-interval '1 day') then return new; end if;
 insert into private.friend_mail_outbox(request_id,sender_id,receiver_id) values(new.id,new.sender_id,new.receiver_id) on conflict do nothing;
 return new;
end $$;
revoke all on function private.enqueue_friend_mail() from public,anon,authenticated;
create trigger enqueue_friend_mail after insert on public.friend_requests for each row execute function private.enqueue_friend_mail();

grant usage on schema private to service_role;
grant select on private.friend_mail_config to service_role;
grant select,update on private.friend_mail_outbox to service_role;
create function public.friend_mail_authorized(p_token text) returns boolean language sql security invoker set search_path='' as $$
 select exists(select 1 from private.friend_mail_config where token=p_token and length(p_token)>60);
$$;
revoke all on function public.friend_mail_authorized(text) from public,anon,authenticated;
grant execute on function public.friend_mail_authorized(text) to service_role;

create function public.claim_friend_mail() returns setof private.friend_mail_outbox
 language plpgsql security invoker set search_path='' as $$
declare q private.friend_mail_outbox; r record;
begin
 for q in select * from private.friend_mail_outbox where state='pending' and next_attempt_at<=now() order by created_at limit 10 for update skip locked loop
  select u.email, s.language, coalesce(s.friend_request_emails,true) emails, coalesce(s.notifications_enabled,true) alerts,
   p.display_name, u.email_confirmed_at, f.status, p.account_status sender_status, recipient.account_status receiver_status
  into r from public.friend_requests f
  join auth.users u on u.id=f.receiver_id
  join public.profiles p on p.id=f.sender_id
  join public.profiles recipient on recipient.id=f.receiver_id
  left join public.user_settings s on s.user_id=f.receiver_id
  where f.id=q.request_id and f.sender_id=q.sender_id and f.receiver_id=q.receiver_id;
  if not found or r.status<>'pending' or r.email is null or r.email_confirmed_at is null or not r.emails or not r.alerts
    or r.sender_status<>'active' or r.receiver_status<>'active'
    or exists(select 1 from public.contacts c where c.is_blocked and ((c.user_id=q.sender_id and c.contact_user_id=q.receiver_id) or (c.user_id=q.receiver_id and c.contact_user_id=q.sender_id))) then
   update private.friend_mail_outbox set state='skipped',payload=null where request_id=q.request_id;
   continue;
  end if;
  if q.attempts>=6 or q.created_at<now()-interval '20 hours' then
   update private.friend_mail_outbox set state='failed',last_error='retry_limit',payload=null where request_id=q.request_id;
   continue;
  end if;
  update private.friend_mail_outbox set attempts=attempts+1,next_attempt_at=now()+interval '3 minutes',
   payload=coalesce(payload,jsonb_build_object('email',r.email,'language',coalesce(r.language,'pt'),'name',left(coalesce(r.display_name,'Yamilook'),100)))
   where request_id=q.request_id returning * into q;
  return next q;
 end loop;
end $$;
revoke all on function public.claim_friend_mail() from public,anon,authenticated;
grant execute on function public.claim_friend_mail() to service_role;

create function public.finish_friend_mail(p_request_id uuid,p_attempt integer,p_state text,p_provider_id text default null,p_error text default null)
 returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_state not in ('sent','failed','pending') then raise exception 'invalid_state'; end if;
 update private.friend_mail_outbox set state=p_state,provider_id=left(p_provider_id,150),last_error=left(p_error,100),
 sent_at=case when p_state='sent' then now() else null end,
 payload=case when p_state='pending' then payload else null end
 where request_id=p_request_id and attempts=p_attempt and state='pending';
end $$;
revoke all on function public.finish_friend_mail(uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_friend_mail(uuid,integer,text,text,text) to service_role;

-- Scheduler secret remains inside the database; this function is not client-callable.
create function private.run_friend_mail() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.friend_mail_outbox where created_at<now()-interval '30 days';
 if not exists(select 1 from private.friend_mail_outbox where state='pending' and next_attempt_at<=now()) then return; end if;
 perform net.http_post(url:='https://rfayqekonkovfbkwjjum.supabase.co/functions/v1/friend-request-mail',
  headers:=jsonb_build_object('Content-Type','application/json','x-friend-mail-token',(select token from private.friend_mail_config)),body:='{}'::jsonb,timeout_milliseconds:=120000);
end $$;
revoke all on function private.run_friend_mail() from public,anon,authenticated;
select cron.schedule('friend-request-mail','* * * * *','select private.run_friend_mail()');
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='friend_requests') then
  alter publication supabase_realtime add table public.friend_requests;
 end if;
end $$;
