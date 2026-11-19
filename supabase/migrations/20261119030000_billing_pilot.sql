create table public.billing_pilot_sales (
  id uuid primary key,
  owner_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  business text not null check (length(trim(business)) between 1 and 160),
  nif text not null check (nif ~ '^[A-Za-z0-9]{8,16}$'),
  customer text not null check (length(trim(customer)) between 1 and 160),
  description text not null check (length(trim(description)) between 1 and 300),
  quantity integer not null check (quantity between 1 and 10000),
  unit_price numeric(14,2) not null check (unit_price > 0),
  rate numeric(5,2) not null check (rate between 0 and 100),
  total numeric generated always as (quantity * unit_price + round(quantity * unit_price * rate / 100, 2)) stored
);
create table public.billing_pilot_receipts (
  id uuid primary key,
  sale_id uuid not null references public.billing_pilot_sales,
  created_at timestamptz not null default now(),
  amount numeric(18,2) not null check (amount > 0),
  method text not null check (method in ('Numerário','Transferência'))
);
alter table public.billing_pilot_sales enable row level security;
alter table public.billing_pilot_receipts enable row level security;
revoke all on public.billing_pilot_sales, public.billing_pilot_receipts from public, anon, authenticated;
grant select on public.billing_pilot_sales, public.billing_pilot_receipts to authenticated;
grant insert (id,business,nif,customer,description,quantity,unit_price,rate) on public.billing_pilot_sales to authenticated;
create policy billing_read on public.billing_pilot_sales for select to authenticated using
(owner_id = auth.uid() and (public.wallet_pilot_manage('status',null)->>'allowed')::boolean);
create policy billing_create on public.billing_pilot_sales for insert to authenticated with check
(owner_id = auth.uid() and (public.wallet_pilot_manage('status',null)->>'allowed')::boolean);
create policy billing_receipts_read on public.billing_pilot_receipts for select to authenticated using
(exists (select 1 from public.billing_pilot_sales s where s.id = sale_id));
create index billing_sales_owner on public.billing_pilot_sales(owner_id,created_at desc);
create index billing_receipts_sale on public.billing_pilot_receipts(sale_id);
create function public.billing_pilot_receive(p_id uuid,p_sale uuid,p_amount numeric,p_method text)
returns void language plpgsql security definer set search_path = '' as $$
declare due numeric;
begin
  if auth.uid() is null or (public.wallet_pilot_manage('status',null)->>'allowed')::boolean is not true then
    raise exception 'Acesso reservado';
  end if;
  select total into strict due from public.billing_pilot_sales where id=p_sale and owner_id=auth.uid() for update;
  if exists(select 1 from public.billing_pilot_receipts where id=p_id and sale_id=p_sale and amount=p_amount and method=p_method) then return; end if;
  select due-coalesce(sum(amount),0) into due from public.billing_pilot_receipts where sale_id=p_sale;
  if p_amount <= 0 or p_amount <> round(p_amount,2) or p_amount > due then raise exception 'Valor fora do saldo disponível'; end if;
  insert into public.billing_pilot_receipts(id,sale_id,amount,method) values(p_id,p_sale,p_amount,p_method);
end $$;
revoke all on function public.billing_pilot_receive(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.billing_pilot_receive(uuid,uuid,numeric,text) to authenticated;