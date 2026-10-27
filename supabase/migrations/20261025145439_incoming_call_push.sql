-- Only the authenticated Edge Function handles subscription material.
create table public.call_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (length(endpoint) <= 2048),
  p256dh text not null,
  auth text not null,
  expires_at timestamptz not null
);
create index call_push_subscriptions_user on public.call_push_subscriptions(user_id, expires_at);
alter table public.call_push_subscriptions enable row level security;
revoke all on public.call_push_subscriptions from public, anon, authenticated;
grant all on public.call_push_subscriptions to service_role;
create table public.call_push_deliveries (
  call_id uuid not null references public.calls(id) on delete cascade,
  subscription_id uuid not null references public.call_push_subscriptions(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  primary key(call_id, subscription_id)
);
create index call_push_deliveries_recent on public.call_push_deliveries(subscription_id, attempted_at);
alter table public.call_push_deliveries enable row level security;
revoke all on public.call_push_deliveries from public, anon, authenticated;
grant all on public.call_push_deliveries to service_role;
create function public.claim_call_push(p_call_id uuid, p_subscription_id uuid) returns boolean
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  perform 1 from public.call_push_subscriptions where id=p_subscription_id for update;
  if not found then return false; end if;
  if (select count(*) from public.call_push_deliveries where subscription_id=p_subscription_id and attempted_at > now()-interval '1 minute') >= 5 then return false; end if;
  insert into public.call_push_deliveries(call_id, subscription_id) values(p_call_id, p_subscription_id) on conflict do nothing;
  return found;
end;
$$;
revoke all on function public.claim_call_push(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_call_push(uuid,uuid) to service_role;

-- Vault is not exposed to browser clients. This invoker RPC does not elevate
-- privileges; only service_role can execute it and already has Vault access.
create function public.get_call_push_vapid() returns jsonb
language sql security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(name, decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets
  where name in ('call_push_vapid_public', 'call_push_vapid_private', 'call_push_vapid_subject');
$$;
revoke all on function public.get_call_push_vapid() from public, anon, authenticated;
grant execute on function public.get_call_push_vapid() to service_role;
