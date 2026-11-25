-- UNITEL Money BuyGoods pilot: existing sandbox orders only. Amounts are AOA
-- cents in the existing simulated ledger. No top-ups, payouts or real funds.
create schema massa_unitel;
revoke all on schema massa_unitel from public, anon, authenticated, service_role;

create table massa_unitel.attempts (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  provider text not null default 'unitel' check (provider = 'unitel'),
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  order_id uuid not null references public.payment_point_orders(id),
  beneficiary_id uuid not null references auth.users(id),
  amount_minor bigint not null check (amount_minor between 1 and 100000000),
  currency text not null default 'AOA' check (currency = 'AOA'),
  phone text not null check (phone ~ '^9[0-9]{8}$'),
  merchant text not null check (length(merchant) between 1 and 120),
  merchant_ref text not null check (merchant_ref ~ '^afm_u_[0-9a-f]{32}$'),
  provider_conversation_id text check (provider_conversation_id is null or provider_conversation_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  provider_transaction_id text check (provider_transaction_id is null or provider_transaction_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  state text not null default 'submitting' check (state in ('submitting', 'pending', 'uncertain', 'confirmed', 'failed', 'expired', 'review')),
  provider_code integer,
  issue_code text check (issue_code is null or issue_code ~ '^[a-z0-9_]{1,100}$'),
  observed_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  next_check_at timestamptz not null default now() + interval '30 seconds',
  lease_until timestamptz,
  lease_token uuid,
  unique (actor_id, request_id),
  unique (environment, merchant, merchant_ref),
  unique (environment, merchant, provider_conversation_id),
  unique (environment, merchant, provider_transaction_id)
);
-- Review is deliberately absent: a late paid observation must be retained even
-- when a replacement attempt already exists. Every prepare checks review too.
create unique index massa_unitel_one_active_order on massa_unitel.attempts(order_id)
  where state in ('submitting', 'pending', 'uncertain', 'confirmed');
create index massa_unitel_attempt_due on massa_unitel.attempts(merchant, next_check_at, id)
  where state in ('submitting', 'pending', 'uncertain');

create table massa_unitel.observations (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references massa_unitel.attempts(id),
  conversation_id text,
  transaction_id text,
  merchant_ref text,
  outcome text not null,
  created_at timestamptz not null default now()
);
create table massa_unitel.events (
  id uuid primary key default gen_random_uuid(),
  event_hash text not null check (event_hash ~ '^[a-f0-9]{64}$'),
  merchant text not null check (length(merchant) between 1 and 120),
  merchant_ref text,
  conversation_id text,
  transaction_id text,
  provider_code integer,
  attempt_id uuid not null references massa_unitel.attempts(id),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  next_check_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  issue_code text check (issue_code is null or issue_code ~ '^[a-z0-9_]{1,100}$'),
  unique (merchant, event_hash)
);
create index massa_unitel_event_due on massa_unitel.events(merchant, next_check_at, id)
  where processed_at is null;
create index massa_unitel_event_attempt on massa_unitel.events(attempt_id, received_at desc);
alter table massa_unitel.attempts enable row level security;
alter table massa_unitel.observations enable row level security;
alter table massa_unitel.events enable row level security;
revoke all on all tables in schema massa_unitel from public, anon, authenticated, service_role;
revoke all on all sequences in schema massa_unitel from public, anon, authenticated, service_role;

create function massa_unitel.immutable_observation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Immutable provider observation'; end;
$$;
create trigger massa_unitel_observation_immutable before update or delete on massa_unitel.observations
for each row execute function massa_unitel.immutable_observation();

alter table public.payment_point_orders drop constraint payment_point_orders_payment_provider_check;
alter table public.payment_point_orders add constraint payment_point_orders_payment_provider_check
  check (payment_provider is null or payment_provider in ('appypay', 'unitel'));

create function public.massa_unitel_prepare(
  p_actor uuid, p_request_id uuid, p_order_id uuid, p_phone text, p_merchant text, p_allowed_beneficiaries uuid[]
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_unitel.attempts; o public.payment_point_orders;
begin
  if p_actor is null or p_request_id is null or not payment_point_private.wallet_access_allowed(p_actor) then
    raise exception 'Acesso reservado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_actor and upper(trim(country_code)) = 'AO') then
    raise exception 'Disponível apenas em Angola' using errcode = '42501';
  end if;
  if p_order_id is null or p_phone is null or p_phone !~ '^9[0-9]{8}$'
    or nullif(trim(p_merchant), '') is null or length(p_merchant) > 120
    or coalesce(cardinality(p_allowed_beneficiaries), 0) = 0 then raise exception 'Cobrança UNITEL inválida'; end if;
  -- Shared lock before all order/wallet row locks: local, AppyPay and UNITEL
  -- mutually exclude new charges. No external HTTP request runs in this tx.
  perform pg_advisory_xact_lock(7218961);
  select * into a from massa_unitel.attempts where actor_id = p_actor and request_id = p_request_id for update;
  if found then
    if a.order_id is distinct from p_order_id or a.phone is distinct from p_phone or a.merchant is distinct from p_merchant then
      raise exception 'Pedido idempotente incompatível';
    end if;
    if not coalesce(a.beneficiary_id = any(p_allowed_beneficiaries), false) then
      raise exception 'Beneficiário fora do piloto UNITEL' using errcode = '42501';
    end if;
    return to_jsonb(a) || jsonb_build_object('submit', false);
  end if;
  select * into o from public.payment_point_orders where id = p_order_id for update;
  if not found or o.status <> 'pending' or o.expires_at <= clock_timestamp() or o.seller_id = p_actor then
    raise exception 'Pedido indisponível';
  end if;
  if not coalesce(o.seller_id = any(p_allowed_beneficiaries), false)
    or not payment_point_private.wallet_access_allowed(o.seller_id)
    or not exists (select 1 from public.profiles where id = o.seller_id and upper(trim(country_code)) = 'AO') then
    raise exception 'Beneficiário fora do piloto UNITEL' using errcode = '42501';
  end if;
  if exists (select 1 from massa_unitel.attempts where order_id = o.id and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed'))
    or exists (select 1 from massa_gateway.attempts where order_id = o.id and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed')) then
    raise exception 'Já existe uma cobrança externa em curso';
  end if;
  insert into public.payment_point_wallets(user_id) values(o.seller_id) on conflict do nothing;
  insert into massa_unitel.attempts(actor_id, request_id, order_id, beneficiary_id, amount_minor, phone, merchant, merchant_ref)
    values (p_actor, p_request_id, o.id, o.seller_id, o.amount, p_phone, p_merchant, 'afm_u_' || replace(gen_random_uuid()::text, '-', ''))
    returning * into a;
  return to_jsonb(a) || jsonb_build_object('submit', true);
end;
$$;

create function public.massa_unitel_get(
  p_actor uuid, p_attempt_id uuid default null, p_order_id uuid default null, p_request_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_unitel.attempts;
begin
  if not payment_point_private.wallet_access_allowed(p_actor) then raise exception 'Acesso reservado' using errcode = '42501'; end if;
  if num_nonnulls(p_attempt_id, p_order_id, p_request_id) <> 1 then raise exception 'Referência inválida'; end if;
  select * into a from massa_unitel.attempts where
    (p_attempt_id is not null and id = p_attempt_id) or (p_order_id is not null and order_id = p_order_id)
    or (p_request_id is not null and request_id = p_request_id and actor_id = p_actor)
    order by created_at desc, id desc limit 1;
  if not found then return null; end if;
  if p_actor not in (a.actor_id, a.beneficiary_id) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  return to_jsonb(a) || jsonb_build_object('phone', case when p_actor = a.actor_id then a.phone else null end);
end;
$$;

create function public.massa_unitel_find(
  p_merchant text, p_merchant_ref text default null, p_conversation_id text default null,
  p_attempt_id uuid default null, p_transaction_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_unitel.attempts;
begin
  if num_nonnulls(p_merchant_ref, p_conversation_id, p_attempt_id, p_transaction_id) = 0 then return null; end if;
  select * into a from massa_unitel.attempts where merchant = p_merchant
    and (p_merchant_ref is null or merchant_ref = p_merchant_ref)
    and (p_attempt_id is null or id = p_attempt_id)
    and (p_conversation_id is null or provider_conversation_id = p_conversation_id
      or (provider_conversation_id is null and num_nonnulls(p_merchant_ref, p_attempt_id) > 0))
    and (p_transaction_id is null or provider_transaction_id = p_transaction_id
      or (provider_transaction_id is null and num_nonnulls(p_merchant_ref, p_conversation_id, p_attempt_id) > 0))
    order by created_at desc, id desc limit 1;
  if not found then return null; end if;
  if exists (select 1 from massa_unitel.attempts where merchant = p_merchant and id <> a.id
    and ((p_conversation_id is not null and provider_conversation_id = p_conversation_id)
      or (p_transaction_id is not null and provider_transaction_id = p_transaction_id))) then return null; end if;
  return to_jsonb(a);
end;
$$;

create function public.massa_unitel_record(
  p_attempt_id uuid, p_state text default 'uncertain', p_conversation_id text default null,
  p_transaction_id text default null, p_code integer default null, p_issue text default null,
  p_observed_paid boolean default false, p_bind_identity boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_unitel.attempts; mismatch boolean;
begin
  if p_state is null or p_state not in ('pending', 'uncertain', 'failed', 'expired', 'review')
    or (p_conversation_id is not null and p_conversation_id !~ '^[A-Za-z0-9_-]{1,128}$')
    or (p_transaction_id is not null and p_transaction_id !~ '^[A-Za-z0-9_-]{1,128}$')
    or (p_issue is not null and p_issue !~ '^[a-z0-9_]{1,100}$') then raise exception 'Estado UNITEL inválido'; end if;
  perform pg_advisory_xact_lock(7218961);
  select * into strict a from massa_unitel.attempts where id = p_attempt_id for update;
  mismatch := (p_conversation_id is not null and a.provider_conversation_id is not null and a.provider_conversation_id <> p_conversation_id)
    or (p_transaction_id is not null and a.provider_transaction_id is not null and a.provider_transaction_id <> p_transaction_id)
    or exists (select 1 from massa_unitel.attempts where merchant = a.merchant and id <> a.id
      and ((p_conversation_id is not null and provider_conversation_id = p_conversation_id)
        or (p_transaction_id is not null and provider_transaction_id = p_transaction_id)));
  if p_observed_paid or mismatch then
    insert into massa_unitel.observations(attempt_id, conversation_id, transaction_id, outcome)
      values (a.id, p_conversation_id, p_transaction_id,
        case when mismatch then 'payment_identity_mismatch' else coalesce(p_issue, 'incomplete_paid_observation') end);
  end if;
  if mismatch then p_state := 'review'; p_issue := 'payment_identity_mismatch'; end if;
  if p_observed_paid then p_state := 'review'; p_issue := coalesce(p_issue, 'incomplete_paid_observation'); end if;
  -- Review and a posted settlement are sticky. Later failures never erase paid
  -- evidence or unlock a second debit. A contradictory query may carry a receipt
  -- that must be audited without reserving it for the wrong attempt. The service
  -- sets bind_identity=false for such unvalidated identities; confirm separately
  -- reserves receipts from responses whose original reference was validated.
  if a.state in ('confirmed', 'review') then
    update massa_unitel.attempts set observed_paid = observed_paid or coalesce(p_observed_paid, false),
      provider_conversation_id = case when coalesce(p_bind_identity, false) and not mismatch then coalesce(provider_conversation_id, p_conversation_id) else provider_conversation_id end,
      provider_transaction_id = case when coalesce(p_bind_identity, false) and not mismatch then coalesce(provider_transaction_id, p_transaction_id) else provider_transaction_id end,
      issue_code = case when a.state = 'confirmed' and mismatch then 'post_confirmation_mismatch' else issue_code end,
      updated_at = clock_timestamp(), lease_until = null, lease_token = null where id = a.id returning * into a;
    return to_jsonb(a);
  end if;
  if a.state in ('failed', 'expired') and p_state <> 'review' then return to_jsonb(a); end if;
  update massa_unitel.attempts set state = p_state, provider_code = p_code, issue_code = p_issue,
    observed_paid = observed_paid or coalesce(p_observed_paid, false),
    provider_conversation_id = case when coalesce(p_bind_identity, false) and not mismatch then coalesce(provider_conversation_id, p_conversation_id) else provider_conversation_id end,
    provider_transaction_id = case when coalesce(p_bind_identity, false) and not mismatch then coalesce(provider_transaction_id, p_transaction_id) else provider_transaction_id end,
    updated_at = clock_timestamp(), next_check_at = clock_timestamp() + interval '30 seconds',
    lease_until = null, lease_token = null where id = a.id returning * into a;
  return to_jsonb(a);
end;
$$;

-- Invoked ONLY by the service after an authenticated QueryTransaction reports
-- Completed with a receipt for this attempt's OriginatorConversationID. The API
-- response does not expose an amount; order amount/recipient come from prepare.
create function public.massa_unitel_confirm(p_attempt_id uuid, p_transaction_id text, p_merchant_ref text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_unitel.attempts; o public.payment_point_orders; w public.payment_point_wallets;
  issue_value text; identity_valid boolean; journal uuid;
begin
  perform pg_advisory_xact_lock(7218961);
  select * into strict a from massa_unitel.attempts where id = p_attempt_id for update;
  identity_valid := coalesce(p_transaction_id ~ '^[A-Za-z0-9_-]{1,128}$', false)
    and p_merchant_ref is not distinct from a.merchant_ref
    and (a.provider_transaction_id is null or a.provider_transaction_id = p_transaction_id)
    and not exists (select 1 from massa_unitel.attempts where merchant = a.merchant and provider_transaction_id = p_transaction_id and id <> a.id);
  if not identity_valid then issue_value := 'payment_identity_mismatch'; end if;
  if a.state = 'confirmed' then
    insert into massa_unitel.observations(attempt_id, transaction_id, merchant_ref, outcome)
      values (a.id, p_transaction_id, p_merchant_ref, coalesce(issue_value, 'confirmed_replay'));
    if issue_value is not null then
      update massa_unitel.attempts set issue_code = 'post_confirmation_mismatch', updated_at = clock_timestamp() where id = a.id returning * into a;
    end if;
    return to_jsonb(a);
  end if;
  if a.state = 'review' then issue_value := coalesce(issue_value, a.issue_code, 'manual_review_required'); end if;
  select * into strict o from public.payment_point_orders where id = a.order_id for update;
  if o.status <> 'pending' or o.expires_at <= clock_timestamp() then issue_value := coalesce(issue_value, 'order_unavailable_after_payment'); end if;
  if o.amount <> a.amount_minor or o.seller_id <> a.beneficiary_id then issue_value := coalesce(issue_value, 'order_changed'); end if;
  if exists (select 1 from massa_unitel.attempts where order_id = a.order_id and id <> a.id
    and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed'))
    or exists (select 1 from massa_gateway.attempts where order_id = a.order_id and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed')) then
    issue_value := coalesce(issue_value, 'another_attempt_exists');
  end if;
  if not payment_point_private.wallet_access_allowed(a.actor_id) or not payment_point_private.wallet_access_allowed(a.beneficiary_id)
    or (select count(*) from public.profiles where id in (a.actor_id, a.beneficiary_id) and upper(trim(country_code)) = 'AO') <> 2 then
    issue_value := coalesce(issue_value, 'wallet_access_changed');
  end if;
  select * into strict w from public.payment_point_wallets where user_id = a.beneficiary_id for update;
  if w.purchased + w.earned + w.reserved + a.amount_minor > 100000000 then issue_value := coalesce(issue_value, 'wallet_test_limit'); end if;
  if exists (select 1 from payment_point_private.journals where operation = 'payment' and reference = a.order_id) then
    issue_value := coalesce(issue_value, 'ledger_reference_conflict');
  end if;
  insert into massa_unitel.observations(attempt_id, transaction_id, merchant_ref, outcome)
    values (a.id, p_transaction_id, p_merchant_ref, coalesce(issue_value, 'confirmed'));
  if issue_value is not null then
    update massa_unitel.attempts set state = 'review', observed_paid = true, issue_code = issue_value,
      provider_transaction_id = case when identity_valid then p_transaction_id else provider_transaction_id end,
      updated_at = clock_timestamp(), lease_until = null, lease_token = null where id = a.id returning * into a;
    return to_jsonb(a);
  end if;
  update massa_unitel.attempts set state = 'confirmed', provider_transaction_id = p_transaction_id,
    observed_paid = true, provider_code = 0, issue_code = null, confirmed_at = clock_timestamp(),
    updated_at = clock_timestamp(), lease_until = null, lease_token = null where id = a.id returning * into a;
  insert into payment_point_private.journals(operation, reference) values ('payment', a.order_id) returning id into journal;
  update public.payment_point_wallets set earned = earned + a.amount_minor where user_id = a.beneficiary_id;
  update public.payment_point_orders set buyer_id = a.actor_id, status = 'paid', purchased_used = 0, earned_used = 0,
    payment_provider = 'unitel' where id = a.order_id;
  insert into public.payment_point_entries(journal_id, user_id, account, amount, operation, reference) values
    (journal, null, 'clearing', -a.amount_minor, 'payment', a.order_id),
    (journal, a.beneficiary_id, 'earned', a.amount_minor, 'payment', a.order_id);
  return to_jsonb(a);
end;
$$;

-- A callback is an unsigned hint. Only known attempts are queued, no callback
-- field is bound onto the attempt, and this RPC never updates financial state.
create function public.massa_unitel_event(
  p_event_hash text, p_merchant text, p_merchant_ref text default null, p_conversation_id text default null,
  p_transaction_id text default null, p_code integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e massa_unitel.events; a jsonb;
begin
  if p_event_hash is null or p_event_hash !~ '^[a-f0-9]{64}$'
    or (p_merchant_ref is not null and p_merchant_ref !~ '^[A-Za-z0-9_-]{1,64}$')
    or (p_conversation_id is not null and p_conversation_id !~ '^[A-Za-z0-9_-]{1,128}$')
    or (p_transaction_id is not null and p_transaction_id !~ '^[A-Za-z0-9_-]{1,128}$') then raise exception 'Evento UNITEL inválido'; end if;
  a := public.massa_unitel_find(p_merchant, p_merchant_ref, p_conversation_id, null, p_transaction_id);
  if a is null then return jsonb_build_object('event_id', null, 'duplicate', false, 'attempt_id', null, 'processed_at', null); end if;
  perform pg_advisory_xact_lock(hashtextextended('massa-unitel-event:' || (a->>'id'), 0));
  select * into e from massa_unitel.events where merchant = p_merchant and event_hash = p_event_hash;
  if found then return jsonb_build_object('event_id', e.id, 'duplicate', true, 'attempt_id', e.attempt_id, 'processed_at', e.processed_at); end if;
  -- Bound both delivery bursts and lifetime retention per attempt. Once the cap
  -- is hit, the periodic attempt worker still checks pending payments directly.
  if (select count(*) from massa_unitel.events where attempt_id = (a->>'id')::uuid and received_at > clock_timestamp() - interval '1 minute') >= 10
    or (select count(*) from massa_unitel.events where attempt_id = (a->>'id')::uuid) >= 100 then
    select * into strict e from massa_unitel.events where attempt_id = (a->>'id')::uuid order by received_at desc, id desc limit 1;
    return jsonb_build_object('event_id', e.id, 'duplicate', true, 'attempt_id', e.attempt_id, 'processed_at', e.processed_at, 'rate_limited', true);
  end if;
  insert into massa_unitel.events(event_hash, merchant, merchant_ref, conversation_id, transaction_id, provider_code, attempt_id)
    values (p_event_hash, p_merchant, p_merchant_ref, p_conversation_id, p_transaction_id, p_code, (a->>'id')::uuid)
    on conflict (merchant, event_hash) do nothing returning * into e;
  if not found then
    select * into strict e from massa_unitel.events where merchant = p_merchant and event_hash = p_event_hash;
    return jsonb_build_object('event_id', e.id, 'duplicate', true, 'attempt_id', e.attempt_id, 'processed_at', e.processed_at);
  end if;
  return jsonb_build_object('event_id', e.id, 'duplicate', false, 'attempt_id', e.attempt_id, 'processed_at', e.processed_at);
end;
$$;

create function public.massa_unitel_event_done(p_event_id uuid, p_issue text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update massa_unitel.events set processed_at = case when p_issue is null or p_issue in ('event_mismatch', 'attempt_not_found')
      then coalesce(processed_at, clock_timestamp()) else processed_at end,
    issue_code = p_issue, next_check_at = clock_timestamp() + interval '60 seconds', lease_until = null, lease_token = null where id = p_event_id;
  if not found then raise exception 'Evento indisponível'; end if;
end;
$$;

create function public.massa_unitel_events_due(p_merchant text, p_limit integer default 25, p_lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if nullif(trim(p_merchant), '') is null or p_limit is null or p_limit not between 1 and 100
    or p_lease_seconds is null or p_lease_seconds not between 15 and 300 then raise exception 'Lote inválido'; end if;
  with selected as (
    select id from massa_unitel.events where merchant = p_merchant and processed_at is null
      and next_check_at <= clock_timestamp() and (lease_until is null or lease_until < clock_timestamp())
      order by next_check_at, id for update skip locked limit p_limit
  ), leased as (
    update massa_unitel.events e set lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      lease_token = gen_random_uuid(), next_check_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
      from selected s where e.id = s.id returning e.*
  ) select coalesce(jsonb_agg(to_jsonb(leased) || jsonb_build_object('event_id', id) order by next_check_at, id), '[]'::jsonb)
    into result from leased;
  return result;
end;
$$;

create function public.massa_unitel_due(p_merchant text, p_limit integer default 25, p_lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if nullif(trim(p_merchant), '') is null or p_limit is null or p_limit not between 1 and 100
    or p_lease_seconds is null or p_lease_seconds not between 15 and 300 then raise exception 'Lote inválido'; end if;
  with selected as (
    select id from massa_unitel.attempts where merchant = p_merchant and state in ('submitting', 'pending', 'uncertain')
      and next_check_at <= clock_timestamp() and (lease_until is null or lease_until < clock_timestamp())
      order by next_check_at, id for update skip locked limit p_limit
  ), leased as (
    update massa_unitel.attempts a set lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      lease_token = gen_random_uuid(), next_check_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
      from selected s where a.id = s.id returning a.*
  ) select coalesce(jsonb_agg(to_jsonb(leased) order by next_check_at, id), '[]'::jsonb) into result from leased;
  return result;
end;
$$;

-- Existing AppyPay prepare shares the global lock. Its INSERT must check UNITEL
-- too, including when an old AppyPay attempt failed and UNITEL replaced it.
create function massa_unitel.guard_gateway_attempt() returns trigger
language plpgsql security definer set search_path = '' as $$
declare guarded boolean;
begin
  guarded := tg_op = 'INSERT';
  if tg_op = 'UPDATE' then
    guarded := new.order_id is distinct from old.order_id or (new.state = 'confirmed' and old.state <> 'confirmed')
      or (new.state in ('submitting', 'pending', 'uncertain') and old.state not in ('submitting', 'pending', 'uncertain'));
  end if;
  if guarded and new.order_id is not null and new.state in ('submitting', 'pending', 'uncertain', 'confirmed')
    and exists (select 1 from massa_unitel.attempts where order_id = new.order_id and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed')) then
    raise exception 'Já existe uma cobrança externa em curso';
  end if;
  return new;
end;
$$;
create trigger massa_unitel_gateway_guard before insert or update on massa_gateway.attempts
for each row execute function massa_unitel.guard_gateway_attempt();

-- Preserve the original AppyPay settlement implementation, adding a symmetric
-- late-success branch that retains evidence instead of retrying a forbidden post.
alter function public.massa_gateway_confirm(uuid, text, text, bigint, text, text) rename to confirm_appypay_impl;
alter function public.confirm_appypay_impl(uuid, text, text, bigint, text, text) set schema massa_gateway;
revoke all on function massa_gateway.confirm_appypay_impl(uuid, text, text, bigint, text, text) from public, anon, authenticated, service_role;
create function public.massa_gateway_confirm(
  p_attempt_id uuid, p_charge_id text, p_merchant_ref text, p_amount_minor bigint, p_currency text, p_method text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_gateway.attempts;
begin
  perform pg_advisory_xact_lock(7218961);
  select * into strict a from massa_gateway.attempts where id = p_attempt_id for update;
  if a.state <> 'confirmed' and a.order_id is not null and exists (
    select 1 from massa_unitel.attempts where order_id = a.order_id and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed')
  ) then
    insert into massa_gateway.observations(attempt_id, charge_id, merchant_ref, amount_minor, currency, method, outcome)
      values (a.id, p_charge_id, p_merchant_ref, p_amount_minor, p_currency, p_method, 'another_provider_attempt_exists');
    update massa_gateway.attempts set state = 'review', observed_paid = true,
      issue_code = case when state = 'review' then coalesce(issue_code, 'another_provider_attempt_exists') else 'another_provider_attempt_exists' end,
      updated_at = clock_timestamp(), lease_until = null, lease_token = null where id = a.id returning * into a;
    return to_jsonb(a);
  end if;
  return massa_gateway.confirm_appypay_impl(p_attempt_id, p_charge_id, p_merchant_ref, p_amount_minor, p_currency, p_method);
end;
$$;

create or replace function massa_gateway.guard_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.payment_provider in ('appypay', 'unitel') and (new.status is distinct from old.status
      or new.payment_provider is distinct from old.payment_provider or new.buyer_id is distinct from old.buyer_id
      or new.seller_id is distinct from old.seller_id or new.amount is distinct from old.amount
      or new.purchased_used is distinct from old.purchased_used or new.earned_used is distinct from old.earned_used) then
    raise exception 'O reembolso externo requer confirmação do prestador';
  end if;
  if new.status is distinct from old.status and (
    exists (select 1 from massa_gateway.attempts where order_id = old.id and state in ('submitting', 'pending', 'uncertain', 'review'))
    or exists (select 1 from massa_unitel.attempts where order_id = old.id and state in ('submitting', 'pending', 'uncertain', 'review'))
  ) then raise exception 'A cobrança externa está por confirmar'; end if;
  if new.payment_provider = 'appypay' and (new.status <> 'paid' or not exists (
    select 1 from massa_gateway.attempts where order_id = new.id and state = 'confirmed' and observed_paid
      and actor_id = new.buyer_id and beneficiary_id = new.seller_id and amount_minor = new.amount
  )) then raise exception 'Confirmação externa em falta'; end if;
  if new.payment_provider = 'unitel' and (new.status <> 'paid' or not exists (
    select 1 from massa_unitel.attempts where order_id = new.id and state = 'confirmed' and observed_paid
      and actor_id = new.buyer_id and beneficiary_id = new.seller_id and amount_minor = new.amount
  )) then raise exception 'Confirmação externa em falta'; end if;
  return new;
end;
$$;

create or replace function public.payment_point_action(p_action text, p_id uuid default null, p_amount bigint default null, p_text text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; provider_value text;
begin
  if not coalesce(public.has_wallet_access(), false) then raise exception 'Acesso reservado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(7218961);
  if p_action in ('pay', 'refund', 'cancel') then
    perform 1 from public.payment_point_orders where id = p_id for update;
    if exists (select 1 from massa_gateway.attempts where order_id = p_id and state in ('submitting', 'pending', 'uncertain', 'review'))
      or exists (select 1 from massa_unitel.attempts where order_id = p_id and state in ('submitting', 'pending', 'uncertain', 'review')) then
      raise exception 'A cobrança externa está por confirmar';
    end if;
    if p_action = 'refund' and exists (select 1 from public.payment_point_orders where id = p_id and payment_provider in ('appypay', 'unitel')) then
      raise exception 'O reembolso externo requer confirmação do prestador';
    end if;
  elsif p_action = 'topup' and (exists (select 1 from massa_gateway.attempts where id = p_id)
    or exists (select 1 from massa_unitel.attempts where id = p_id)) then
    raise exception 'Referência reservada à cobrança externa';
  end if;
  result := payment_point_private.massa_action_impl(p_action, p_id, p_amount, p_text);
  if p_action = 'view' then
    select payment_provider into provider_value from public.payment_point_orders where id = p_id;
    result := result || jsonb_build_object('payment_provider', provider_value);
  end if;
  return result;
end;
$$;
revoke all on function public.payment_point_action(text, uuid, bigint, text) from public, anon;
grant execute on function public.payment_point_action(text, uuid, bigint, text) to authenticated;

-- The private schema remains unreachable even with the service role. Only these
-- definer RPCs can mutate it; the Edge layer supplies authenticated actor/config.
revoke all on all functions in schema massa_unitel from public, anon, authenticated, service_role;
revoke all on function public.massa_unitel_prepare(uuid, uuid, uuid, text, text, uuid[]),
  public.massa_unitel_get(uuid, uuid, uuid, uuid), public.massa_unitel_find(text, text, text, uuid, text),
  public.massa_unitel_record(uuid, text, text, text, integer, text, boolean, boolean), public.massa_unitel_confirm(uuid, text, text),
  public.massa_unitel_event(text, text, text, text, text, integer), public.massa_unitel_event_done(uuid, text),
  public.massa_unitel_due(text, integer, integer), public.massa_unitel_events_due(text, integer, integer),
  public.massa_gateway_confirm(uuid, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.massa_unitel_prepare(uuid, uuid, uuid, text, text, uuid[]),
  public.massa_unitel_get(uuid, uuid, uuid, uuid), public.massa_unitel_find(text, text, text, uuid, text),
  public.massa_unitel_record(uuid, text, text, text, integer, text, boolean, boolean), public.massa_unitel_confirm(uuid, text, text),
  public.massa_unitel_event(text, text, text, text, text, integer), public.massa_unitel_event_done(uuid, text),
  public.massa_unitel_due(text, integer, integer), public.massa_unitel_events_due(text, integer, integer),
  public.massa_gateway_confirm(uuid, text, text, bigint, text, text) to service_role;
