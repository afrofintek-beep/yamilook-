-- Explicit import of an untrusted demonstration quote by its designated test merchant.
create function public.billing_import_sumba_demo(p_ref text,p_cents bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sale uuid;
begin
 if (public.wallet_pilot_manage('status',null)->>'allowed')::boolean is not true or
 not exists(select 1 from public.billing_app_access where principal=auth.uid() and merchant=auth.uid() and app='sumba' and nif='TESTSUMBA01' and can_create)
 then raise exception 'Comerciante de ensaio não autorizado'; end if;
 if p_ref is null or p_ref !~ '^[A-Za-z0-9_-]{1,100}$' or p_cents is null or p_cents not between 1 and 100000000000 then raise exception 'Encomenda de ensaio inválida'; end if;
 sale:=public.billing_open_order(auth.uid(),'TESTSUMBA01',p_ref,'Cliente fictício','Encomenda SUMBA de ensaio',1,p_cents/100.0,0);
 return public.billing_order_balance(sale);
end $$;
revoke all on function public.billing_import_sumba_demo(text,bigint) from public,anon;
grant execute on function public.billing_import_sumba_demo(text,bigint) to authenticated;