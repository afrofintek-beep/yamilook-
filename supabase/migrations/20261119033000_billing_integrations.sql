-- All records originate in the billing pilot. Consumers must use sandbox credentials.
create table public.billing_fiscal_requests (
  sale_id uuid primary key references public.billing_pilot_sales,
  requested_at timestamptz not null default now(),
  provider_document text unique,
  state text not null default 'pending' check (state in ('pending','accepted','rejected')),
  check (state <> 'accepted' or nullif(trim(provider_document),'') is not null)
);
alter table public.billing_fiscal_requests enable row level security;
revoke all on public.billing_fiscal_requests from public, anon, authenticated;
grant select,insert(sale_id) on public.billing_fiscal_requests to authenticated;
create policy fiscal_read on public.billing_fiscal_requests for select to authenticated using
(exists(select 1 from public.billing_pilot_sales s where s.id=sale_id));
create policy fiscal_request on public.billing_fiscal_requests for insert to authenticated with check
(exists(select 1 from public.billing_pilot_sales s where s.id=sale_id));

-- Export stable source IDs and decimal values for mapping to the merchant's chart of accounts.
create view public.billing_pilot_journal with (security_invoker=true) as
select s.nif,s.id sale_id,s.id source_id,s.created_at,l.account_role,l.debit,l.credit
from public.billing_pilot_sales s cross join lateral (values
 ('clientes',s.total,0::numeric),
 ('vendas',0,s.quantity*s.unit_price),
 ('iva_simulado',0,s.total-s.quantity*s.unit_price)
) l(account_role,debit,credit) where l.debit<>0 or l.credit<>0
union all
select s.nif,s.id,r.id,r.created_at,l.account_role,l.debit,l.credit
from public.billing_pilot_receipts r join public.billing_pilot_sales s on s.id=r.sale_id
cross join lateral (values (r.method,r.amount,0::numeric),('clientes',0,r.amount)) l(account_role,debit,credit);
revoke all on public.billing_pilot_journal from public,anon,authenticated;
grant select on public.billing_pilot_journal to authenticated;

-- Only a trusted sandbox connector may bind provider orders and confirm collections.
create table public.billing_collection_links (
  provider text not null check(provider in ('kumbu','appypay')),
  merchant_key text not null,
  order_key text not null,
  sale_id uuid not null references public.billing_pilot_sales,
  expected_cents bigint not null check(expected_cents>0),
  receipt_id uuid unique references public.billing_pilot_receipts,
  primary key(provider,merchant_key,order_key)
);
alter table public.billing_collection_links enable row level security;
revoke all on public.billing_collection_links from public,anon,authenticated;
grant select,insert on public.billing_collection_links to service_role;
alter table public.billing_pilot_receipts drop constraint billing_pilot_receipts_method_check;
alter table public.billing_pilot_receipts add check(method in ('Numerário','Transferência','Kumbu','AppyPay'));
create function public.billing_pilot_confirm_collection(p_provider text,p_merchant text,p_order text,p_cents bigint,p_currency text)
returns uuid language plpgsql security definer set search_path='' as $$
declare link public.billing_collection_links; due numeric; receipt uuid;
begin
 select * into strict link from public.billing_collection_links where provider=p_provider and merchant_key=p_merchant and order_key=p_order for update;
 if p_currency is distinct from 'AOA' or p_cents is distinct from link.expected_cents then raise exception 'Divergência no pagamento'; end if;
 if link.receipt_id is not null then return link.receipt_id; end if;
 select total into strict due from public.billing_pilot_sales where id=link.sale_id for update;
 select due-coalesce(sum(amount),0) into due from public.billing_pilot_receipts where sale_id=link.sale_id;
 if p_cents/100.0>due then raise exception 'Valor superior ao saldo'; end if;
 receipt:=gen_random_uuid();
 insert into public.billing_pilot_receipts values(receipt,link.sale_id,now(),p_cents/100.0,case p_provider when 'kumbu' then 'Kumbu' else 'AppyPay' end);
 update public.billing_collection_links set receipt_id=receipt where provider=p_provider and merchant_key=p_merchant and order_key=p_order;
 return receipt;
end $$;
revoke all on function public.billing_pilot_confirm_collection(text,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.billing_pilot_confirm_collection(text,text,text,bigint,text) to service_role;

create table public.billing_tax_pilot (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null default auth.uid(),
 nif text not null, tax text not null check(length(trim(tax)) between 1 and 100),
 due_date date not null, amount numeric(16,2) not null check(amount>0),
 reference text not null check(length(trim(reference)) between 1 and 100),
 requested_at timestamptz, confirmed_reference text, confirmed_at timestamptz,
 unique(owner_id,nif,reference),
 check ((confirmed_at is null)=(confirmed_reference is null)),
 check (confirmed_at is null or requested_at is not null)
);
alter table public.billing_tax_pilot enable row level security;
revoke all on public.billing_tax_pilot from public,anon,authenticated;
grant select,insert(nif,tax,due_date,amount,reference) on public.billing_tax_pilot to authenticated;
create policy tax_read on public.billing_tax_pilot for select to authenticated using
(owner_id=auth.uid() and (public.wallet_pilot_manage('status',null)->>'allowed')::boolean);
create policy tax_add on public.billing_tax_pilot for insert to authenticated with check
(owner_id=auth.uid() and exists(select 1 from public.billing_pilot_sales s where s.nif=billing_tax_pilot.nif));
create function public.billing_tax_request(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if (public.wallet_pilot_manage('status',null)->>'allowed')::boolean is not true then raise exception 'Acesso reservado'; end if;
 update public.billing_tax_pilot set requested_at=coalesce(requested_at,now()) where id=p_id and owner_id=auth.uid();
 if not found then raise exception 'Obrigação indisponível'; end if;
end $$;
revoke all on function public.billing_tax_request(uuid) from public,anon;
grant execute on function public.billing_tax_request(uuid) to authenticated;
create or replace function public.billing_pilot_receive(p_id uuid,p_sale uuid,p_amount numeric,p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare due numeric;
begin
  if p_method not in ('Numerário','Transferência') then raise exception 'Meio reservado ao conector'; end if;
  if auth.uid() is null or (public.wallet_pilot_manage('status',null)->>'allowed')::boolean is not true then
    raise exception 'Acesso reservado';
  end if;
  select total into strict due from public.billing_pilot_sales where id=p_sale and owner_id=auth.uid() for update;
  if exists(select 1 from public.billing_pilot_receipts where id=p_id and sale_id=p_sale and amount=p_amount and method=p_method) then return; end if;
  select due-coalesce(sum(amount),0) into due from public.billing_pilot_receipts where sale_id=p_sale;
  if p_amount <= 0 or p_amount <> round(p_amount,2) or p_amount > due then raise exception 'Valor fora do saldo disponível'; end if;
  insert into public.billing_pilot_receipts(id,sale_id,amount,method) values(p_id,p_sale,p_amount,p_method);
end $$;

create function public.billing_match_kumbu(p_sale uuid,p_order uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.payment_point_orders;
begin
 if (public.wallet_pilot_manage('status',null)->>'allowed')::boolean is not true then raise exception 'Acesso reservado'; end if;
 select * into strict o from public.payment_point_orders where id=p_order and seller_id=auth.uid() and status='paid' for share;
 perform 1 from public.billing_pilot_sales where id=p_sale and owner_id=auth.uid();
 if not found then raise exception 'Venda indisponível'; end if;
 insert into public.billing_collection_links(provider,merchant_key,order_key,sale_id,expected_cents)
 values('kumbu',o.seller_id::text,o.id::text,p_sale,o.amount) on conflict do nothing;
 if not exists(select 1 from public.billing_collection_links where provider='kumbu' and merchant_key=o.seller_id::text and order_key=o.id::text and sale_id=p_sale) then raise exception 'Pedido já associado'; end if;
 return public.billing_pilot_confirm_collection('kumbu',o.seller_id::text,o.id::text,o.amount,'AOA');
end $$;
revoke all on function public.billing_match_kumbu(uuid,uuid) from public,anon;
grant execute on function public.billing_match_kumbu(uuid,uuid) to authenticated;
