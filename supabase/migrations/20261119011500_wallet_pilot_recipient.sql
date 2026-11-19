do $$
declare definition text;
begin
 definition:=pg_get_functiondef('public.payment_point_action(text,uuid,bigint,text)'::regprocedure);
 definition:=regexp_replace(definition,'\mbegin\M',E'begin\n if p_action=''pay'' and exists(select 1 from public.payment_point_orders where id=p_id and not payment_point_private.wallet_access_allowed(seller_id)) then raise exception ''O destinatário ainda não tem acesso à carteira.'' using errcode=''42501''; end if;','i');
 execute definition;
end $$;
