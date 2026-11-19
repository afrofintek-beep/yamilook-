-- Sandbox integration principals are provisioned per application and merchant.
create table public.billing_app_access (
 principal uuid not null, app text not null check(app ~ '^[a-z][a-z0-9_-]{1,48}$'),
 merchant uuid not null, nif text not null, business text not null,
 can_create boolean not null default false,
 primary key(principal,merchant,nif), unique(principal,app,merchant,nif)
);
alter table public.billing_app_access enable row level security;
revoke all on public.billing_app_access from public,anon,authenticated;
create table public.billing_origin (
 sale_id uuid primary key references public.billing_pilot_sales,
 app text not null, merchant uuid not null, nif text not null,
 order_ref text not null check(length(trim(order_ref)) between 1 and 160),
 unique(app,merchant,nif,order_ref)
);
alter table public.billing_origin enable row level security;
revoke all on public.billing_origin from public,anon,authenticated;

create function public.billing_open_order(p_merchant uuid,p_nif text,p_order text,p_customer text,p_description text,p_qty integer,p_price numeric,p_rate numeric)
returns uuid language plpgsql security definer set search_path='' as $$
declare access public.billing_app_access; sale uuid; existing public.billing_pilot_sales;
begin
 select * into strict access from public.billing_app_access where principal=auth.uid() and merchant=p_merchant and nif=p_nif and can_create;
 if p_price<>round(p_price,2) or p_rate<>round(p_rate,2) then raise exception 'Precisão inválida'; end if;
 perform pg_advisory_xact_lock(hashtextextended(jsonb_build_array(access.app,p_merchant,p_nif,trim(p_order))::text,0));
 select sale_id into sale from public.billing_origin where app=access.app and merchant=p_merchant and nif=p_nif and order_ref=trim(p_order);
 if sale is not null then
   select * into strict existing from public.billing_pilot_sales where id=sale;
   if row(existing.customer,existing.description,existing.quantity,existing.unit_price,existing.rate)
     is distinct from row(p_customer,p_description,p_qty,p_price,p_rate) then raise exception 'Referência associada a uma venda diferente'; end if;
   return sale;
 end if;
 sale:=gen_random_uuid();
 insert into public.billing_pilot_sales(id,owner_id,business,nif,customer,description,quantity,unit_price,rate)
 values(sale,p_merchant,access.business,p_nif,p_customer,p_description,p_qty,p_price,p_rate);
 insert into public.billing_origin values(sale,access.app,p_merchant,p_nif,trim(p_order));
 insert into public.billing_fiscal_requests(sale_id) values(sale);
 return sale;
end $$;

create function public.billing_order_balance(p_sale uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('sale_id',s.id,'order_ref',o.order_ref,'currency','AOA','total',s.total,
 'received',r.amount,'outstanding',s.total-r.amount,'fiscal_state',f.state)
 from public.billing_origin o join public.billing_pilot_sales s on s.id=o.sale_id
 join public.billing_fiscal_requests f on f.sale_id=s.id
 cross join lateral(select coalesce(sum(amount),0) amount from public.billing_pilot_receipts where sale_id=s.id and method<>'Kumbu') r
 where s.id=p_sale and exists(select 1 from public.billing_app_access a where a.principal=auth.uid() and a.merchant=o.merchant and a.nif=o.nif)
$$;
revoke all on function public.billing_open_order(uuid,text,text,text,text,integer,numeric,numeric), public.billing_order_balance(uuid) from public,anon;
grant execute on function public.billing_open_order(uuid,text,text,text,text,integer,numeric,numeric), public.billing_order_balance(uuid) to authenticated;
-- Virtual KUMBU cannot settle an AOA receivable. Historical rows stay available for review.
revoke execute on function public.billing_match_kumbu(uuid,uuid) from authenticated;
alter table public.billing_pilot_receipts add constraint billing_aoa_methods check(method <> 'Kumbu') not valid;
