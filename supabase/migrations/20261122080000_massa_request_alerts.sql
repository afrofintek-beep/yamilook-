alter table public.call_push_subscriptions add column payment_alert_owner uuid;
create table public.payment_request_push_deliveries (
 order_id uuid references public.payment_point_orders(id) on delete cascade,
 subscription_id uuid references public.call_push_subscriptions(id) on delete cascade,
 attempted_at timestamptz not null default now(),
 primary key(order_id,subscription_id)
);
alter table public.payment_request_push_deliveries enable row level security;
revoke all on public.payment_request_push_deliveries from public, anon, authenticated;
grant all on public.payment_request_push_deliveries to service_role;
create index payment_request_push_recent on public.payment_request_push_deliveries(subscription_id,attempted_at);

create function public.claim_payment_request_push(p_order uuid,p_conversation uuid,p_sender uuid)
returns setof public.call_push_subscriptions language plpgsql security definer set search_path='' as $$
declare device public.call_push_subscriptions;
begin
 for device in select s.* from public.call_push_subscriptions s
 join public.conversation_participants cp on cp.user_id=s.user_id and cp.conversation_id=p_conversation
 join public.conversations c on c.id=cp.conversation_id and c.type='direct'
 join public.payment_point_orders o on o.id=p_order and o.seller_id=p_sender
 where s.payment_alert_owner=s.user_id and s.expires_at>now() and s.user_id<>p_sender
 and o.status='pending' and o.expires_at>now()
 and payment_point_private.wallet_access_allowed(s.user_id)
 and payment_point_private.wallet_access_allowed(p_sender)
 and exists(select 1 from public.conversation_participants sender where sender.user_id=p_sender and sender.conversation_id=c.id)
 and exists(select 1 from public.messages m where m.conversation_id=c.id and m.sender_id=p_sender
 and starts_with(m.content,E'Pedido de pagamento · TESTE\n') and right(m.content,51)='/payment-point/'||p_order::text)
 and not exists(select 1 from public.blocked_users b where (b.blocker_id,b.blocked_id) in ((s.user_id,p_sender),(p_sender,s.user_id)))
 order by s.id for update of s
 loop
  if (select count(*) from public.payment_request_push_deliveries where subscription_id=device.id and attempted_at>now()-interval '1 minute')<5 then
   insert into public.payment_request_push_deliveries(order_id,subscription_id) values(p_order,device.id) on conflict do nothing;
   if found then return next device; end if;
  end if;
 end loop;
end;
$$;
revoke all on function public.claim_payment_request_push(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_payment_request_push(uuid,uuid,uuid) to service_role;
