-- TEMPORARY DATABASE TEST ONLY. CLI-generated filename moved out of migrations.
-- Target: kvnbqqektpkeouyepyor. No payment network or production operations.
-- Must be dropped after the single authorised Edge invocation.
do $guard$ begin
 if not exists(select 1 from massa_test_harness.installation where singleton and target_project='kvnbqqektpkeouyepyor') then
  raise exception 'Wrong MASSA test harness target';
 end if;
end $guard$;

create table massa_test_harness.concurrent_probe (
 singleton boolean primary key default true check(singleton),
 actor_id uuid not null references auth.users(id),
 seller_id uuid not null references auth.users(id),
 order_id uuid not null default gen_random_uuid(),
 request_id uuid not null default gen_random_uuid(),
 charge_id uuid not null default gen_random_uuid(),
 merchant text not null default 'MASSA_STRICT_a37da1b90bf6',
 amount_minor bigint not null default 4321 check(amount_minor=4321),
 seller_before bigint not null,
 expires_at timestamptz not null default clock_timestamp()+interval '30 minutes',
 claimed_at timestamptz,
 prepare_calls integer not null default 0 check(prepare_calls between 0 and 2),
 confirm_calls integer not null default 0 check(confirm_calls between 0 and 2),
 finished_at timestamptz
);
alter table massa_test_harness.concurrent_probe enable row level security;
revoke all on massa_test_harness.concurrent_probe from public,anon,authenticated,service_role;
insert into massa_test_harness.concurrent_probe(actor_id,seller_id,seller_before)
 select buyer.id,seller.id,w.earned from auth.users buyer
 join public.profiles bp on bp.id=buyer.id
 cross join auth.users seller
 join public.profiles sp on sp.id=seller.id
 join public.payment_point_wallets w on w.user_id=seller.id
 where buyer.email='massa-db-a37da1b90bf6-buyer@example.invalid'
  and bp.username='massa_db_a37da1b90bf6_buyer'
  and seller.email='massa-db-a37da1b90bf6-seller@example.invalid'
  and sp.username='massa_db_a37da1b90bf6_seller';

do $seed$
declare c massa_test_harness.concurrent_probe;
begin
 select * into strict c from massa_test_harness.concurrent_probe where singleton;
 if not payment_point_private.wallet_access_allowed(c.actor_id)
  or not payment_point_private.wallet_access_allowed(c.seller_id) then raise exception 'Synthetic pilot access missing'; end if;
 perform set_config('request.jwt.claim.sub',c.seller_id::text,true);
 perform public.payment_point_action('create',c.order_id,c.amount_minor,'Synthetic strict database concurrency test');
end $seed$;

create function public.massa_test_probe(p_action text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c massa_test_harness.concurrent_probe; a jsonb; result jsonb;
 started timestamptz:=clock_timestamp(); rpc_returned timestamptz; j bigint; e bigint; s bigint; delta bigint;
begin
 if not exists(select 1 from massa_test_harness.installation where singleton and target_project='kvnbqqektpkeouyepyor') then
  raise exception 'Wrong test harness';
 end if;
 select * into strict c from massa_test_harness.concurrent_probe where singleton;
 if c.expires_at<=clock_timestamp() or c.finished_at is not null then raise exception 'Probe unavailable'; end if;
 if p_action='start' then
  update massa_test_harness.concurrent_probe set claimed_at=clock_timestamp()
   where singleton and claimed_at is null returning * into c;
  if not found then raise exception 'Probe already claimed'; end if;
  return jsonb_build_object('started',true);
 end if;
 if c.claimed_at is null or p_action not in ('prepare','confirm','finish') or p_action is null then raise exception 'Invalid probe phase'; end if;
 -- Do not acquire a test lock or lock the context before the real RPC. The RPC
 -- itself must supply all financial serialization; sleep only retains its lock.
 if p_action='prepare' then
  if c.prepare_calls>=2 or c.confirm_calls<>0 then raise exception 'Prepare phase complete'; end if;
  result:=public.massa_gateway_prepare(c.actor_id,c.request_id,'REF',null,c.merchant,c.order_id,null);
  rpc_returned:=clock_timestamp();
  if (result->>'submit')::boolean then
   perform public.massa_gateway_record((result->>'id')::uuid,c.charge_id::text,'pending',101);
   result:=result||jsonb_build_object('state','pending');
  end if;
  update massa_test_harness.concurrent_probe set prepare_calls=prepare_calls+1
   where singleton and prepare_calls<2 and confirm_calls=0 and finished_at is null;
  if not found then raise exception 'Prepare phase complete'; end if;
 elsif p_action='confirm' then
  if c.prepare_calls<>2 or c.confirm_calls>=2 then raise exception 'Invalid confirmation phase'; end if;
  a:=public.massa_gateway_get(c.actor_id,null,c.order_id,null);
  if c.confirm_calls=0 and a->>'state' is distinct from 'pending' then raise exception 'First confirmation must start pending'; end if;
  if c.confirm_calls=1 and a->>'state' is distinct from 'confirmed' then raise exception 'Replay must observe confirmed'; end if;
  result:=public.massa_gateway_confirm((a->>'id')::uuid,c.charge_id::text,a->>'merchant_ref',c.amount_minor,'AOA','REF');
  rpc_returned:=clock_timestamp();
  if result->>'state' is distinct from 'confirmed' then raise exception 'Confirmation failed'; end if;
  update massa_test_harness.concurrent_probe set confirm_calls=confirm_calls+1
   where singleton and prepare_calls=2 and confirm_calls<2 and finished_at is null;
  if not found then raise exception 'Confirmation phase complete'; end if;
 else
  if c.prepare_calls<>2 or c.confirm_calls<>2 then raise exception 'Probe incomplete'; end if;
  select count(*) into j from payment_point_private.journals where reference=c.order_id;
  select count(*),coalesce(sum(amount),0) into e,s from public.payment_point_entries where reference=c.order_id;
  select earned-c.seller_before into delta from public.payment_point_wallets where user_id=c.seller_id;
  if j<>1 or e<>2 or s<>0 or delta<>c.amount_minor then raise exception 'Ledger assertion failed'; end if;
  update massa_test_harness.concurrent_probe set finished_at=clock_timestamp() where singleton;
  return jsonb_build_object('journal_count',j,'ledger_entries',e,'ledger_sum',s,'seller_delta',delta,
   'attempt_count',(select count(*) from massa_gateway.attempts where order_id=c.order_id),
   'prepare_calls',c.prepare_calls,'confirm_calls',c.confirm_calls);
 end if;
 perform pg_sleep(2);
 return jsonb_build_object('phase',p_action,'backend_pid',pg_backend_pid(),'started_at',started,
  'rpc_returned_at',rpc_returned,'finished_at',clock_timestamp(),'id',result->>'id','submit',result->'submit','state',result->>'state',
  'initial_state',a->>'state','holds_wallet_lock',exists(select 1 from pg_locks where pid=pg_backend_pid()
    and locktype='advisory' and classid=0 and objid=7218961 and granted));
end;
$$;
revoke all on function public.massa_test_probe(text) from public,anon,authenticated;
grant execute on function public.massa_test_probe(text) to service_role;
