-- This pilot represents Angola only. Future markets require their own wallets
-- and settlement integrations rather than reinterpreting these AOA balances.
alter table public.payment_point_wallets
 add column country_code text not null default 'AO' check(country_code='AO'),
 add column currency text not null default 'AOA' check(currency='AOA');
alter table public.payment_point_orders
 add column country_code text not null default 'AO' check(country_code='AO'),
 add column currency text not null default 'AOA' check(currency='AOA');
alter table public.payment_point_withdrawals
 add column country_code text not null default 'AO' check(country_code='AO'),
 add column currency text not null default 'AOA' check(currency='AOA');
alter table public.payment_point_entries
 add column country_code text not null default 'AO' check(country_code='AO'),
 add column currency text not null default 'AOA' check(currency='AOA');

alter function public.payment_point_action(text,uuid,bigint,text) set schema payment_point_private;
revoke all on function payment_point_private.payment_point_action(text,uuid,bigint,text) from public,anon,authenticated;
create function public.payment_point_action(p_action text,p_id uuid default null,p_amount bigint default null,p_text text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); country text; seller uuid; result jsonb;
begin
 if u is null then raise exception 'Sessão necessária'; end if;
 select upper(trim(country_code)) into country from public.profiles where id=u for share;
 if p_action in ('merchant','topup','create','pay','withdraw')
    or (p_action='overview' and not exists(select 1 from public.payment_point_wallets where user_id=u)) then
  if country is distinct from 'AO' then
   raise exception 'O Payment Point Angola está disponível para contas com Angola definido no perfil. As outras geografias terão carteiras e operadores próprios.';
  end if;
 end if;
 if p_action='pay' then
  select seller_id into seller from public.payment_point_orders where id=p_id;
  select upper(trim(country_code)) into country from public.profiles where id=seller for share;
  if country is distinct from 'AO' then raise exception 'O destinatário precisa de estar associado a Angola para receber este pagamento.'; end if;
 end if;
 result:=payment_point_private.payment_point_action(p_action,p_id,p_amount,p_text);
 return result || jsonb_build_object('country_code','AO','currency','AOA');
end $$;
revoke all on function public.payment_point_action(text,uuid,bigint,text) from public,anon;
grant execute on function public.payment_point_action(text,uuid,bigint,text) to authenticated;
