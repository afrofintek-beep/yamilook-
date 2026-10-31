-- Fulfilment is a server-only operation. RLS cannot protect SECURITY DEFINER
-- functions whose EXECUTE privilege is inherited from PUBLIC.
revoke all on function public.fulfill_credit_purchase(uuid,text) from public, anon, authenticated;
revoke all on function public.fulfill_kumbu_purchase(uuid,text) from public, anon, authenticated;
revoke all on function public.fulfill_pro_subscription(uuid,text) from public, anon, authenticated;
grant execute on function public.fulfill_credit_purchase(uuid,text) to service_role;
grant execute on function public.fulfill_kumbu_purchase(uuid,text) to service_role;
grant execute on function public.fulfill_pro_subscription(uuid,text) to service_role;
