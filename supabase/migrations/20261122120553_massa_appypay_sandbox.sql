-- Sandbox only. This migration does not enable a gateway or schedule a worker.
-- The Edge adapter authenticates the user and calls these service-role-only RPCs.
create schema massa_gateway;
revoke all on schema massa_gateway from public, anon, authenticated, service_role;

create table massa_gateway.attempts (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  provider text not null default 'appypay' check (provider = 'appypay'),
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  order_id uuid references public.payment_point_orders(id),
  purpose text not null check (purpose in ('order', 'topup')),
  beneficiary_id uuid not null references auth.users(id),
  amount_minor bigint not null check (amount_minor between 1 and 100000000),
  currency text not null default 'AOA' check (currency = 'AOA'),
  method text not null check (method in ('GPO', 'REF')),
  -- Only AppyPay's published dummy phone cases; no live customer telephone.
  phone text check (phone is null or phone ~ '^90000000[0-3]$'),
  merchant text not null check (length(merchant) between 1 and 120),
  merchant_ref text not null check (merchant_ref ~ '^[A-Za-z0-9]{1,15}$'),
  provider_charge_id text check (provider_charge_id is null or provider_charge_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  state text not null default 'submitting' check (state in ('submitting', 'pending', 'uncertain', 'confirmed', 'failed', 'expired', 'review')),
  provider_code integer,
  reference text check (reference is null or length(reference) between 1 and 120),
  entity text check (entity is null or length(entity) between 1 and 80),
  provider_due_at timestamptz,
  issue_code text check (issue_code is null or issue_code ~ '^[a-z0-9_]{1,100}$'),
  observed_paid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  next_check_at timestamptz not null default now() + interval '30 seconds',
  lease_until timestamptz,
  lease_token uuid,
  check ((purpose = 'order') = (order_id is not null)),
  check ((method = 'GPO' and phone is not null) or (method = 'REF' and phone is null)),
  unique (actor_id, request_id),
  unique (environment, merchant, merchant_ref),
  unique (environment, merchant, provider_charge_id)
);
create unique index massa_gateway_one_active_order on massa_gateway.attempts(order_id)
  where order_id is not null and state in ('submitting', 'pending', 'uncertain', 'confirmed');
create index massa_gateway_due on massa_gateway.attempts(merchant, next_check_at, id)
  where state in ('submitting', 'pending', 'uncertain');

-- This is a minimal audit trail of authenticated GET results; never store raw
-- gateway payloads, OAuth credentials, or telephone numbers here.
create table massa_gateway.observations (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references massa_gateway.attempts(id),
  charge_id text,
  merchant_ref text,
  amount_minor bigint,
  currency text,
  method text,
  outcome text not null,
  created_at timestamptz not null default now()
);
create table massa_gateway.events (
  id uuid primary key default gen_random_uuid(),
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  merchant text not null check (length(merchant) between 1 and 120),
  charge_id text,
  merchant_ref text,
  provider_code integer,
  attempt_id uuid references massa_gateway.attempts(id),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  next_check_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  issue_code text check (issue_code is null or issue_code ~ '^[a-z0-9_]{1,100}$'),
  unique (merchant, event_hash)
);
create index massa_gateway_events_due on massa_gateway.events(merchant, next_check_at, id) where processed_at is null;
create index massa_gateway_event_rate on massa_gateway.events(attempt_id, received_at desc);
alter table massa_gateway.attempts enable row level security;
alter table massa_gateway.observations enable row level security;
alter table massa_gateway.events enable row level security;
revoke all on all tables in schema massa_gateway from public, anon, authenticated, service_role;
revoke all on all sequences in schema massa_gateway from public, anon, authenticated, service_role;

create function massa_gateway.immutable_observation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception 'Gateway evidence is immutable'; end;
$$;
create trigger massa_gateway_evidence before update or delete on massa_gateway.observations
for each row execute function massa_gateway.immutable_observation();

alter table public.payment_point_orders add column payment_provider text
  check (payment_provider is null or payment_provider = 'appypay');

create function public.massa_gateway_prepare(
  p_actor uuid, p_request_id uuid, p_method text, p_phone text, p_merchant text,
  p_order_id uuid default null, p_amount_minor bigint default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_gateway.attempts; o public.payment_point_orders; beneficiary uuid; amount_value bigint; ref_value text;
begin
  if p_actor is null or p_request_id is null or not payment_point_private.wallet_access_allowed(p_actor) then
    raise exception 'Acesso reservado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = p_actor and upper(trim(country_code)) = 'AO') then
    raise exception 'A carteira de teste requer Angola no perfil';
  end if;
  if p_method not in ('GPO', 'REF') or p_method is null or nullif(trim(p_merchant), '') is null
    or length(p_merchant) > 120 or p_merchant <> trim(p_merchant) then raise exception 'Configuração de cobrança inválida'; end if;
  if (p_method = 'GPO' and (p_phone is null or p_phone !~ '^90000000[0-3]$'))
    or (p_method = 'REF' and p_phone is not null) then raise exception 'Telefone de teste inválido'; end if;
  if p_order_id is not null and p_amount_minor is not null then raise exception 'O valor do pedido é definido no servidor'; end if;
  -- Use the pilot's lock before any wallet/order row lock. No gateway HTTP call
  -- occurs inside the transaction. The wrapper below gives internal paths the
  -- same lock order, avoiding payment-vs-confirmation deadlocks.
  perform pg_advisory_xact_lock(7218961);
  select * into a from massa_gateway.attempts where actor_id = p_actor and request_id = p_request_id for update;
  if found then
    if a.order_id is distinct from p_order_id or a.method is distinct from p_method
      or a.phone is distinct from p_phone or a.merchant is distinct from p_merchant
      or (p_order_id is null and a.amount_minor is distinct from p_amount_minor) then
      raise exception 'Referência idempotente associada a outros dados';
    end if;
    return to_jsonb(a) || jsonb_build_object('submit', false);
  end if;
  if p_order_id is not null then
    select * into o from public.payment_point_orders where id = p_order_id for update;
    if not found or o.status <> 'pending' or o.expires_at <= clock_timestamp() or o.seller_id = p_actor then
      raise exception 'Pedido indisponível';
    end if;
    if not payment_point_private.wallet_access_allowed(o.seller_id)
      or not exists (select 1 from public.profiles where id = o.seller_id and upper(trim(country_code)) = 'AO') then
      raise exception 'Destinatário indisponível' using errcode = '42501';
    end if;
    if exists (select 1 from massa_gateway.attempts where order_id = p_order_id
      and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed')) then
      raise exception 'Este pedido já tem uma cobrança externa em curso';
    end if;
    beneficiary := o.seller_id; amount_value := o.amount;
  else
    if p_amount_minor is null or p_amount_minor not between 1 and 100000000 then raise exception 'Valor de teste inválido'; end if;
    beneficiary := p_actor; amount_value := p_amount_minor;
  end if;
  insert into public.payment_point_wallets(user_id) values (beneficiary) on conflict do nothing;
  loop
    ref_value := 'M' || left(replace(gen_random_uuid()::text, '-', ''), 14);
    exit when not exists (select 1 from massa_gateway.attempts where merchant = p_merchant and merchant_ref = ref_value);
  end loop;
  insert into massa_gateway.attempts(actor_id, request_id, order_id, purpose, beneficiary_id, amount_minor, method, phone, merchant, merchant_ref)
    values (p_actor, p_request_id, p_order_id, case when p_order_id is null then 'topup' else 'order' end,
      beneficiary, amount_value, p_method, p_phone, p_merchant, ref_value) returning * into a;
  return to_jsonb(a) || jsonb_build_object('submit', true);
end;
$$;

create function public.massa_gateway_get(
  p_actor uuid, p_attempt_id uuid default null, p_order_id uuid default null, p_request_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_gateway.attempts;
begin
  if p_actor is null or not payment_point_private.wallet_access_allowed(p_actor) then
    raise exception 'Acesso reservado' using errcode = '42501';
  end if;
  if num_nonnulls(p_attempt_id, p_order_id, p_request_id) <> 1 then raise exception 'Indique uma referência'; end if;
  select * into a from massa_gateway.attempts
    where (p_attempt_id is not null and id = p_attempt_id)
      or (p_order_id is not null and order_id = p_order_id)
      or (p_request_id is not null and request_id = p_request_id and actor_id = p_actor)
    order by created_at desc, id desc limit 1;
  if not found then return null; end if;
  if p_actor not in (a.actor_id, a.beneficiary_id) then raise exception 'Sem permissão' using errcode = '42501'; end if;
  -- A recipient must not receive the payer's telephone number.
  return to_jsonb(a) || case when p_actor <> a.actor_id then jsonb_build_object('phone', null) else '{}'::jsonb end;
end;
$$;

create function public.massa_gateway_find(p_merchant text, p_charge_id text default null, p_merchant_ref text default null, p_attempt_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_gateway.attempts;
begin
  if p_charge_id is null and p_merchant_ref is null and p_attempt_id is null then return null; end if;
  select * into a from massa_gateway.attempts where merchant = p_merchant
    and (p_attempt_id is null or id = p_attempt_id)
    and (p_merchant_ref is null or merchant_ref = p_merchant_ref)
    and (p_charge_id is null or provider_charge_id = p_charge_id
      or (provider_charge_id is null and (p_merchant_ref is not null or p_attempt_id is not null)))
    order by created_at desc limit 1;
  if not found then return null; end if;
  if p_charge_id is not null and exists (select 1 from massa_gateway.attempts where merchant = p_merchant
    and provider_charge_id = p_charge_id and id <> a.id) then return null; end if;
  return to_jsonb(a);
end;
$$;

create function public.massa_gateway_record(
  p_attempt_id uuid, p_charge_id text default null, p_state text default 'uncertain',
  p_code integer default null, p_issue text default null, p_reference text default null,
  p_entity text default null, p_due timestamptz default null, p_observed_paid boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_gateway.attempts; issue_value text := p_issue; state_value text := p_state;
begin
  if p_state is null or p_state not in ('pending', 'uncertain', 'failed', 'expired', 'review') then raise exception 'Estado externo inválido'; end if;
  perform pg_advisory_xact_lock(7218961);
  select * into strict a from massa_gateway.attempts where id = p_attempt_id for update;
  if p_observed_paid then
    insert into massa_gateway.observations(attempt_id, charge_id, outcome)
      values (a.id, p_charge_id, coalesce(p_issue, 'paid_response_requires_review'));
    state_value := 'review'; issue_value := coalesce(p_issue, 'paid_response_requires_review');
  end if;
  -- A repeated or out-of-order event may not undo a confirmation or evidence
  -- requiring review. Only confirm() is allowed to move money.
  if a.state in ('confirmed', 'review') then
    if p_observed_paid and not a.observed_paid then
      update massa_gateway.attempts set observed_paid = true, updated_at = clock_timestamp() where id = a.id returning * into a;
    end if;
    return to_jsonb(a);
  end if;
  if p_charge_id is not null and (p_charge_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (a.provider_charge_id is not null and a.provider_charge_id <> p_charge_id)
    or exists (select 1 from massa_gateway.attempts where merchant = a.merchant and provider_charge_id = p_charge_id and id <> a.id)) then
    state_value := 'review'; issue_value := 'charge_identity_mismatch';
  end if;
  if a.state in ('failed', 'expired') and state_value <> 'review' then return to_jsonb(a); end if;
  update massa_gateway.attempts set
    provider_charge_id = case when issue_value = 'charge_identity_mismatch' then provider_charge_id else coalesce(provider_charge_id, p_charge_id) end,
    state = state_value, provider_code = coalesce(p_code, provider_code), issue_code = issue_value,
    observed_paid = observed_paid or coalesce(p_observed_paid, false),
    reference = coalesce(p_reference, reference), entity = coalesce(p_entity, entity),
    provider_due_at = coalesce(p_due, provider_due_at), updated_at = clock_timestamp(),
    next_check_at = clock_timestamp() + interval '30 seconds', lease_until = null, lease_token = null
    where id = a.id returning * into a;
  return to_jsonb(a);
end;
$$;

create function public.massa_gateway_confirm(
  p_attempt_id uuid, p_charge_id text, p_merchant_ref text, p_amount_minor bigint, p_currency text, p_method text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare a massa_gateway.attempts; o public.payment_point_orders; w public.payment_point_wallets;
  issue_value text; journal uuid; operation_value text; reference_value uuid;
begin
  perform pg_advisory_xact_lock(7218961);
  select * into strict a from massa_gateway.attempts where id = p_attempt_id for update;
  if p_charge_id is null or p_charge_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or (a.provider_charge_id is not null and a.provider_charge_id <> p_charge_id)
    or p_merchant_ref is distinct from a.merchant_ref or p_amount_minor is distinct from a.amount_minor
    or p_currency is distinct from a.currency or p_method is distinct from a.method
    or exists (select 1 from massa_gateway.attempts where merchant = a.merchant and provider_charge_id = p_charge_id and id <> a.id) then
    issue_value := 'payment_identity_mismatch';
  end if;
  -- Once confirmed, a replay cannot produce another journal. Preserve new
  -- conflicting evidence for investigation without reverting a posted ledger.
  if a.state = 'confirmed' then
    insert into massa_gateway.observations(attempt_id, charge_id, merchant_ref, amount_minor, currency, method, outcome)
      values (a.id, p_charge_id, p_merchant_ref, p_amount_minor, p_currency, p_method, coalesce(issue_value, 'confirmed_replay'));
    if issue_value is not null then
      update massa_gateway.attempts set issue_code = 'post_confirmation_mismatch', updated_at = clock_timestamp() where id = a.id returning * into a;
    end if;
    return to_jsonb(a);
  end if;
  if a.state = 'review' then issue_value := coalesce(issue_value, a.issue_code, 'manual_review_required'); end if;
  if a.provider_due_at is not null and a.provider_due_at <= clock_timestamp() then issue_value := coalesce(issue_value, 'late_payment'); end if;
  if a.order_id is not null then
    select * into strict o from public.payment_point_orders where id = a.order_id for update;
    if o.status <> 'pending' or o.expires_at <= clock_timestamp() then issue_value := coalesce(issue_value, 'order_unavailable_after_payment'); end if;
    if o.amount <> a.amount_minor or o.seller_id <> a.beneficiary_id then issue_value := coalesce(issue_value, 'order_changed'); end if;
    if exists (select 1 from massa_gateway.attempts where order_id = a.order_id and id <> a.id
      and state in ('submitting', 'pending', 'uncertain', 'review', 'confirmed')) then
      issue_value := coalesce(issue_value, 'another_attempt_exists');
    end if;
  end if;
  if not payment_point_private.wallet_access_allowed(a.actor_id) or not payment_point_private.wallet_access_allowed(a.beneficiary_id)
    or (select count(*) from public.profiles where id in (a.actor_id, a.beneficiary_id) and upper(trim(country_code)) = 'AO')
      <> (case when a.actor_id = a.beneficiary_id then 1 else 2 end) then issue_value := coalesce(issue_value, 'wallet_access_changed'); end if;
  select * into strict w from public.payment_point_wallets where user_id = a.beneficiary_id for update;
  if w.purchased + w.earned + w.reserved + a.amount_minor > 100000000 then issue_value := coalesce(issue_value, 'wallet_test_limit'); end if;
  operation_value := case when a.purpose = 'order' then 'payment' else 'topup' end;
  reference_value := coalesce(a.order_id, a.id);
  if exists (select 1 from payment_point_private.journals where operation = operation_value and reference = reference_value) then
    issue_value := coalesce(issue_value, 'ledger_reference_conflict');
  end if;
  insert into massa_gateway.observations(attempt_id, charge_id, merchant_ref, amount_minor, currency, method, outcome)
    values (a.id, p_charge_id, p_merchant_ref, p_amount_minor, p_currency, p_method, coalesce(issue_value, 'confirmed'));
  if issue_value is not null then
    update massa_gateway.attempts set state = 'review', observed_paid = true, issue_code = issue_value,
      updated_at = clock_timestamp(), lease_until = null, lease_token = null where id = a.id returning * into a;
    return to_jsonb(a);
  end if;
  update massa_gateway.attempts set state = 'confirmed', provider_charge_id = p_charge_id,
    observed_paid = true, provider_code = 100, issue_code = null, confirmed_at = clock_timestamp(),
    updated_at = clock_timestamp(), lease_until = null, lease_token = null where id = a.id returning * into a;
  insert into payment_point_private.journals(operation, reference) values (operation_value, reference_value) returning id into journal;
  if a.purpose = 'order' then
    update public.payment_point_wallets set earned = earned + a.amount_minor where user_id = a.beneficiary_id;
    update public.payment_point_orders set buyer_id = a.actor_id, status = 'paid', purchased_used = 0, earned_used = 0,
      payment_provider = 'appypay' where id = a.order_id;
  else
    update public.payment_point_wallets set purchased = purchased + a.amount_minor where user_id = a.beneficiary_id;
  end if;
  insert into public.payment_point_entries(journal_id, user_id, account, amount, operation, reference) values
    (journal, null, 'clearing', -a.amount_minor, operation_value, reference_value),
    (journal, a.beneficiary_id, case when a.purpose = 'order' then 'earned' else 'purchased' end, a.amount_minor, operation_value, reference_value);
  return to_jsonb(a);
end;
$$;

-- Durable, authenticated delivery inbox. The callback must perform a trusted
-- GET before invoking confirm(); a callback status alone never grants credit.
create function public.massa_gateway_event(
  p_event_hash text, p_merchant text, p_charge_id text default null,
  p_merchant_ref text default null, p_code integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare e massa_gateway.events; a jsonb; duplicate_value boolean;
begin
  a := public.massa_gateway_find(p_merchant, p_charge_id, p_merchant_ref);
  if a is null then
    return jsonb_build_object('event_id', null, 'duplicate', false, 'attempt_id', null, 'processed_at', null);
  end if;
  -- Unsigned callback bodies are only hints. Do not store arbitrary unknown
  -- charge IDs, and bound the number of distinct deliveries per known attempt.
  perform pg_advisory_xact_lock(hashtextextended('massa-event:' || (a->>'id'), 0));
  select * into e from massa_gateway.events where merchant = p_merchant and event_hash = p_event_hash;
  if found then
    return jsonb_build_object('event_id', e.id, 'duplicate', true, 'attempt_id', e.attempt_id, 'processed_at', e.processed_at);
  end if;
  if (select count(*) from massa_gateway.events where attempt_id = (a->>'id')::uuid
      and received_at > clock_timestamp() - interval '1 minute') >= 10 then
    select * into strict e from massa_gateway.events where attempt_id = (a->>'id')::uuid order by received_at desc, id desc limit 1;
    return jsonb_build_object('event_id', e.id, 'duplicate', true, 'attempt_id', e.attempt_id,
      'processed_at', e.processed_at, 'rate_limited', true);
  end if;
  insert into massa_gateway.events(event_hash, merchant, charge_id, merchant_ref, provider_code, attempt_id)
    values (p_event_hash, p_merchant, p_charge_id, p_merchant_ref, p_code, (a->>'id')::uuid)
    on conflict (merchant, event_hash) do nothing returning * into e;
  duplicate_value := not found;
  if duplicate_value then
    update massa_gateway.events set attempt_id = coalesce(attempt_id, (a->>'id')::uuid)
      where merchant = p_merchant and event_hash = p_event_hash returning * into e;
  end if;
  return jsonb_build_object('event_id', e.id, 'duplicate', duplicate_value, 'attempt_id', e.attempt_id, 'processed_at', e.processed_at);
end;
$$;
create function public.massa_gateway_event_done(p_event_id uuid, p_issue text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- A rejected hint is terminal for that delivery. Transport/storage failures
  -- remain pending so a worker can retry verification after its lease expires.
  update massa_gateway.events set processed_at = case when p_issue is null or p_issue in ('event_mismatch', 'attempt_not_found')
      then coalesce(processed_at, clock_timestamp()) else processed_at end,
    issue_code = p_issue, next_check_at = clock_timestamp() + interval '60 seconds', lease_until = null, lease_token = null where id = p_event_id;
  if not found then raise exception 'Evento indisponível'; end if;
end;
$$;

create function public.massa_gateway_events_due(p_merchant text, p_limit integer default 25, p_lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if nullif(trim(p_merchant), '') is null or p_limit not between 1 and 100
    or p_lease_seconds not between 15 and 300 then raise exception 'Lote inválido'; end if;
  with selected as (
    select id from massa_gateway.events where merchant = p_merchant and processed_at is null and attempt_id is not null
      and next_check_at <= clock_timestamp() and (lease_until is null or lease_until < clock_timestamp())
      order by next_check_at, id for update skip locked limit p_limit
  ), leased as (
    update massa_gateway.events e set lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      lease_token = gen_random_uuid(), next_check_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
      from selected s where e.id = s.id returning e.*
  ) select coalesce(jsonb_agg(to_jsonb(leased) || jsonb_build_object('event_id', id) order by next_check_at, id), '[]'::jsonb)
      into result from leased;
  return result;
end;
$$;

create function public.massa_gateway_due(p_merchant text, p_limit integer default 25, p_lease_seconds integer default 60)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if nullif(trim(p_merchant), '') is null or p_limit not between 1 and 100
    or p_lease_seconds not between 15 and 300 then raise exception 'Lote inválido'; end if;
  with selected as (
    select id from massa_gateway.attempts where merchant = p_merchant and state in ('submitting', 'pending', 'uncertain')
      and next_check_at <= clock_timestamp() and (lease_until is null or lease_until < clock_timestamp())
      order by next_check_at, id for update skip locked limit p_limit
  ), leased as (
    update massa_gateway.attempts a set lease_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      lease_token = gen_random_uuid(), next_check_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
      from selected s where a.id = s.id returning a.*
  ) select coalesce(jsonb_agg(to_jsonb(leased) order by next_check_at, id), '[]'::jsonb) into result from leased;
  return result;
end;
$$;

-- Protect the old internal payment/refund/cancel entry points too. A trigger
-- remains the final guard if another privileged wrapper updates an order.
create function massa_gateway.guard_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.payment_provider = 'appypay' and (new.status is distinct from old.status
      or new.payment_provider is distinct from old.payment_provider) then
    raise exception 'O reembolso externo requer confirmação do prestador';
  end if;
  if new.status is distinct from old.status and exists (
    select 1 from massa_gateway.attempts where order_id = old.id and state in ('submitting', 'pending', 'uncertain', 'review')
  ) then raise exception 'A cobrança externa está por confirmar'; end if;
  if new.payment_provider = 'appypay' and not exists (
    select 1 from massa_gateway.attempts where order_id = new.id and state = 'confirmed' and observed_paid
      and actor_id = new.buyer_id and beneficiary_id = new.seller_id and amount_minor = new.amount
  ) then raise exception 'Confirmação externa em falta'; end if;
  return new;
end;
$$;
create trigger massa_gateway_order_guard before update on public.payment_point_orders
for each row execute function massa_gateway.guard_order();

alter function public.payment_point_action(text, uuid, bigint, text) rename to massa_action_impl;
alter function public.massa_action_impl(text, uuid, bigint, text) set schema payment_point_private;
revoke all on function payment_point_private.massa_action_impl(text, uuid, bigint, text) from public, anon, authenticated, service_role;
create function public.payment_point_action(p_action text, p_id uuid default null, p_amount bigint default null, p_text text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; provider_value text;
begin
  if not coalesce(public.has_wallet_access(), false) then raise exception 'Acesso reservado' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(7218961);
  if p_action in ('pay', 'refund', 'cancel') then
    perform 1 from public.payment_point_orders where id = p_id for update;
    if exists (select 1 from massa_gateway.attempts where order_id = p_id and state in ('submitting', 'pending', 'uncertain', 'review')) then
      raise exception 'A cobrança externa está por confirmar';
    end if;
    if p_action = 'refund' and exists (select 1 from public.payment_point_orders where id = p_id and payment_provider = 'appypay') then
      raise exception 'O reembolso externo requer confirmação do prestador';
    end if;
  elsif p_action = 'topup' and exists (select 1 from massa_gateway.attempts where id = p_id) then
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

-- Explicit ACLs are essential: SECURITY DEFINER alone is not authorization.
revoke all on all functions in schema massa_gateway from public, anon, authenticated, service_role;
revoke all on function public.massa_gateway_prepare(uuid, uuid, text, text, text, uuid, bigint),
  public.massa_gateway_get(uuid, uuid, uuid, uuid), public.massa_gateway_find(text, text, text, uuid),
  public.massa_gateway_record(uuid, text, text, integer, text, text, text, timestamptz, boolean),
  public.massa_gateway_confirm(uuid, text, text, bigint, text, text),
  public.massa_gateway_event(text, text, text, text, integer), public.massa_gateway_event_done(uuid, text),
  public.massa_gateway_due(text, integer, integer), public.massa_gateway_events_due(text, integer, integer) from public, anon, authenticated;
grant execute on function public.massa_gateway_prepare(uuid, uuid, text, text, text, uuid, bigint),
  public.massa_gateway_get(uuid, uuid, uuid, uuid), public.massa_gateway_find(text, text, text, uuid),
  public.massa_gateway_record(uuid, text, text, integer, text, text, text, timestamptz, boolean),
  public.massa_gateway_confirm(uuid, text, text, bigint, text, text),
  public.massa_gateway_event(text, text, text, text, integer), public.massa_gateway_event_done(uuid, text),
  public.massa_gateway_due(text, integer, integer), public.massa_gateway_events_due(text, integer, integer) to service_role;
