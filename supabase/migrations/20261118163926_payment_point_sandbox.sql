-- Payment Point pilot. All amounts are simulated AOA cents. No real funds.
create schema if not exists payment_point_private;
revoke all on schema payment_point_private from public;
create table public.payment_point_wallets (
 user_id uuid primary key references auth.users(id),
 purchased bigint not null default 0 check(purchased>=0),
 earned bigint not null default 0 check(earned>=0),
 reserved bigint not null default 0 check(reserved>=0),
 merchant boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.payment_point_orders (
 id uuid primary key,
 seller_id uuid not null references auth.users(id),
 buyer_id uuid references auth.users(id),
 amount bigint not null check(amount between 1 and 100000000),
 description text not null check(length(description) between 1 and 240),
 status text not null default 'pending' check(status in ('pending','paid','refunded','cancelled')),
 purchased_used bigint not null default 0,
 earned_used bigint not null default 0,
 expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now()
);
create table public.payment_point_withdrawals (
 id uuid primary key,
 user_id uuid not null references auth.users(id),
 amount bigint not null check(amount between 1 and 100000000),
 destination text not null check(length(destination) between 3 and 120),
 status text not null default 'pending' check(status in ('pending','processing','completed','rejected','cancelled')),
 evidence text,
 reviewed_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create table payment_point_private.journals (
 id uuid primary key default gen_random_uuid(),
 operation text not null,
 reference uuid not null,
 created_at timestamptz not null default now(),
 unique(operation,reference)
);
create table public.payment_point_entries (
 id bigint generated always as identity primary key,
 journal_id uuid not null references payment_point_private.journals(id),
 user_id uuid references auth.users(id),
 account text not null check(account in ('purchased','earned','reserved','clearing')),
 amount bigint not null check(amount<>0),
 operation text not null,
 reference uuid not null,
 created_at timestamptz not null default now()
);
create index on public.payment_point_entries(user_id,created_at desc);
create index on public.payment_point_orders(seller_id,created_at desc);
create index on public.payment_point_orders(buyer_id,created_at desc);
create index on public.payment_point_withdrawals(user_id,created_at desc);
alter table public.payment_point_wallets enable row level security;
alter table public.payment_point_orders enable row level security;
alter table public.payment_point_withdrawals enable row level security;
alter table public.payment_point_entries enable row level security;
alter table payment_point_private.journals enable row level security;
create policy wallet_owner on public.payment_point_wallets for select to authenticated using(user_id=auth.uid());
create policy order_participant on public.payment_point_orders for select to authenticated using(auth.uid() in(seller_id,buyer_id));
create policy withdrawal_owner on public.payment_point_withdrawals for select to authenticated using(user_id=auth.uid() or public.has_role(auth.uid(),'admin'));
create policy entry_owner on public.payment_point_entries for select to authenticated using(user_id=auth.uid());
revoke all on public.payment_point_wallets, public.payment_point_orders, public.payment_point_withdrawals, public.payment_point_entries from anon, authenticated;
grant select on public.payment_point_wallets, public.payment_point_orders, public.payment_point_withdrawals, public.payment_point_entries to authenticated;

-- Every journal must sum to zero, including external simulated cash movements.
create function payment_point_private.check_balance() returns trigger language plpgsql set search_path='' as $$
begin
 if (select coalesce(sum(amount),0) from public.payment_point_entries where journal_id=new.journal_id)<>0 then
  raise exception 'Unbalanced journal';
 end if;
 return null;
end $$;
create constraint trigger pp_balanced after insert on public.payment_point_entries
 deferrable initially deferred for each row execute function payment_point_private.check_balance();
create function payment_point_private.immutable() returns trigger language plpgsql as $$
begin raise exception 'Immutable ledger'; end $$;
create trigger pp_immutable before update or delete on public.payment_point_entries for each row execute function payment_point_private.immutable();

-- Trusted operations only. Parameters are authenticated and validated here.
create function public.payment_point_action(p_action text,p_id uuid default null,p_amount bigint default null,p_text text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); w public.payment_point_wallets; o public.payment_point_orders;
 r public.payment_point_withdrawals; j uuid; used bigint; result jsonb;
begin
 if u is null then raise exception 'Sessão necessária'; end if;
 -- Serialize pilot operations to make retries, reciprocal payments and refunds atomic.
 perform pg_advisory_xact_lock(7218961);
 insert into public.payment_point_wallets(user_id) values(u) on conflict do nothing;
 select * into w from public.payment_point_wallets where user_id=u for update;
 if p_action='overview' then
  return jsonb_build_object('mode','sandbox','wallet',to_jsonb(w),'admin',public.has_role(u,'admin'),
   'orders',coalesce((select jsonb_agg(t) from (select * from public.payment_point_orders where u in(seller_id,buyer_id) order by created_at desc limit 50)t),'[]'::jsonb),
   'entries',coalesce((select jsonb_agg(t) from (select * from public.payment_point_entries where user_id=u order by id desc limit 100)t),'[]'::jsonb),
   'withdrawals',coalesce((select jsonb_agg(t) from (select * from public.payment_point_withdrawals where user_id=u or public.has_role(u,'admin') order by created_at desc limit 100)t),'[]'::jsonb));
 elsif p_action='merchant' then
  update public.payment_point_wallets set merchant=true where user_id=u;
 elsif p_action='topup' then
  if p_id is null or p_amount is null or p_amount not between 1 and 100000000 then raise exception 'Valor inválido'; end if;
  if exists(select 1 from payment_point_private.journals where operation='topup' and reference=p_id) then
   if not exists(select 1 from public.payment_point_entries where reference=p_id and operation='topup' and user_id=u and amount=p_amount) then raise exception 'Referência incompatível'; end if;
   return jsonb_build_object('ok',true,'mode','sandbox');
  end if;
  if w.purchased+w.earned+w.reserved+p_amount>100000000 then raise exception 'Limite de teste excedido'; end if;
  insert into payment_point_private.journals(operation,reference) values('topup',p_id) returning id into j;
  update public.payment_point_wallets set purchased=purchased+p_amount where user_id=u;
  insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values
   (j,u,'purchased',p_amount,'topup',p_id),(j,null,'clearing',-p_amount,'topup',p_id);
 elsif p_action='create' then
  if not w.merchant then raise exception 'Active a recepção de pagamentos'; end if;
  if p_id is null or p_amount is null or p_text is null then raise exception 'Pedido incompleto'; end if;
  if exists(select 1 from public.payment_point_orders where id=p_id) then
   if not exists(select 1 from public.payment_point_orders where id=p_id and seller_id=u and amount=p_amount and description=trim(p_text)) then raise exception 'Referência incompatível'; end if;
  else
   insert into public.payment_point_orders(id,seller_id,amount,description) values(p_id,u,p_amount,trim(p_text));
  end if;
 elsif p_action in ('view','pay','refund','cancel') then
  select * into o from public.payment_point_orders where id=p_id for update;
  if not found then raise exception 'Pedido indisponível'; end if;
  if p_action='view' then
   return jsonb_build_object('mode','sandbox','id',o.id,'seller_id',o.seller_id,'seller_name',
    (select display_name from public.profiles where id=o.seller_id),'amount',o.amount,'description',o.description,
    'status',o.status,'expires_at',o.expires_at,'own',o.seller_id=u);
  elsif p_action='cancel' then
   if o.seller_id<>u or o.status<>'pending' then raise exception 'Operação indisponível'; end if;
   update public.payment_point_orders set status='cancelled' where id=p_id;
  elsif p_action='pay' then
   if o.status='paid' and o.buyer_id=u then return jsonb_build_object('ok',true,'mode','sandbox'); end if;
   if o.seller_id=u or o.status<>'pending' or o.expires_at<=now() then raise exception 'Pedido indisponível'; end if;
   if w.purchased+w.earned<o.amount then raise exception 'Saldo insuficiente'; end if;
   used:=least(w.purchased,o.amount);
   update public.payment_point_wallets set purchased=purchased-used,earned=earned-(o.amount-used) where user_id=u;
   update public.payment_point_wallets set earned=earned+o.amount where user_id=o.seller_id;
   update public.payment_point_orders set buyer_id=u,status='paid',purchased_used=used,earned_used=o.amount-used where id=p_id;
   insert into payment_point_private.journals(operation,reference) values('payment',p_id) returning id into j;
   if used>0 then insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values(j,u,'purchased',-used,'payment',p_id); end if;
   if o.amount>used then insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values(j,u,'earned',-(o.amount-used),'payment',p_id); end if;
   insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values(j,o.seller_id,'earned',o.amount,'payment',p_id);
  elsif p_action='refund' then
   if o.seller_id<>u then raise exception 'Sem permissão'; end if;
   if o.status='refunded' then return jsonb_build_object('ok',true,'mode','sandbox'); end if;
   if o.status<>'paid' or w.earned<o.amount then raise exception 'Reembolso indisponível ou saldo insuficiente'; end if;
   update public.payment_point_wallets set earned=earned-o.amount where user_id=u;
   update public.payment_point_wallets set purchased=purchased+o.purchased_used,earned=earned+o.earned_used where user_id=o.buyer_id;
   update public.payment_point_orders set status='refunded' where id=p_id;
   insert into payment_point_private.journals(operation,reference) values('refund',p_id) returning id into j;
   insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values(j,u,'earned',-o.amount,'refund',p_id);
   if o.purchased_used>0 then insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values(j,o.buyer_id,'purchased',o.purchased_used,'refund',p_id); end if;
   if o.earned_used>0 then insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values(j,o.buyer_id,'earned',o.earned_used,'refund',p_id); end if;
  end if;
 elsif p_action='withdraw' then
  if p_id is null or p_amount is null or p_amount<=0 or p_text is null then raise exception 'Pedido incompleto'; end if;
  select * into r from public.payment_point_withdrawals where id=p_id;
  if found then
   if r.user_id<>u or r.amount<>p_amount or r.destination<>trim(p_text) then raise exception 'Referência incompatível'; end if;
   return jsonb_build_object('ok',true,'mode','sandbox');
  end if;
  if p_amount>w.earned then raise exception 'Saldo elegível insuficiente'; end if;
  insert into public.payment_point_withdrawals(id,user_id,amount,destination) values(p_id,u,p_amount,trim(p_text));
  update public.payment_point_wallets set earned=earned-p_amount,reserved=reserved+p_amount where user_id=u;
  insert into payment_point_private.journals(operation,reference) values('reserve',p_id) returning id into j;
  insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values
   (j,u,'earned',-p_amount,'reserve',p_id),(j,u,'reserved',p_amount,'reserve',p_id);
 elsif p_action in ('processing','completed','rejected','cancel_withdrawal') then
  select * into r from public.payment_point_withdrawals where id=p_id for update;
  if not found then raise exception 'Pedido indisponível'; end if;
  if p_action='cancel_withdrawal' then
   if r.user_id<>u or r.status<>'pending' then raise exception 'Cancelamento indisponível'; end if;
  elsif not public.has_role(u,'admin') then raise exception 'Sem permissão'; end if;
  if r.status=p_action then return jsonb_build_object('ok',true,'mode','sandbox'); end if;
  if r.status not in ('pending','processing') then raise exception 'Pedido concluído'; end if;
  if p_action='processing' then
   update public.payment_point_withdrawals set status='processing',reviewed_by=u where id=p_id;
  else
   if p_action='completed' and (r.status<>'processing' or coalesce(length(trim(p_text)),0)<3) then raise exception 'Registe a referência de confirmação do teste'; end if;
   if p_action='rejected' and coalesce(length(trim(p_text)),0)<3 then raise exception 'Indique o motivo'; end if;
   update public.payment_point_wallets set reserved=reserved-r.amount,
    earned=earned+case when p_action='completed' then 0 else r.amount end where user_id=r.user_id;
   update public.payment_point_withdrawals set status=case when p_action='cancel_withdrawal' then 'cancelled' else p_action end,evidence=p_text,reviewed_by=u where id=p_id;
   insert into payment_point_private.journals(operation,reference) values('withdrawal_'||p_action,p_id) returning id into j;
   insert into public.payment_point_entries(journal_id,user_id,account,amount,operation,reference) values
    (j,r.user_id,'reserved',-r.amount,'withdrawal_'||p_action,p_id),
    (j,case when p_action='completed' then null else r.user_id end,case when p_action='completed' then 'clearing' else 'earned' end,r.amount,'withdrawal_'||p_action,p_id);
  end if;
 else raise exception 'Operação inválida';
 end if;
 return jsonb_build_object('ok',true,'mode','sandbox','id',p_id);
end $$;
revoke all on function public.payment_point_action(text,uuid,bigint,text) from public,anon;
grant execute on function public.payment_point_action(text,uuid,bigint,text) to authenticated;
