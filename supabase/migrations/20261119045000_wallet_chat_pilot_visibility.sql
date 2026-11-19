create or replace function public.wallet_chat_allowed(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
 select exists (
   select 1 from public.conversations c
   join public.conversation_participants p on p.conversation_id = c.id
   where c.id = p_conversation and c.type = 'direct'
   group by c.id
   having count(*) = 2 and count(distinct p.user_id) = 2
      and bool_or(p.user_id = auth.uid())
      and bool_and(coalesce(payment_point_private.wallet_access_allowed(p.user_id), false))
 );
$$;
revoke all on function public.wallet_chat_allowed(uuid) from public, anon;
grant execute on function public.wallet_chat_allowed(uuid) to authenticated;

create or replace function payment_point_private.guard_chat_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if starts_with(new.content, E'Pedido de pagamento · TESTE\n') and
    (auth.uid() is distinct from new.sender_id or not public.wallet_chat_allowed(new.conversation_id)) then
   raise exception 'Pedido indisponível nesta conversa' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger wallet_chat_guard before insert or update of content, conversation_id, sender_id on public.messages
for each row execute function payment_point_private.guard_chat_request();

create policy wallet_chat_request_visibility on public.messages as restrictive for select to authenticated
using (not coalesce(starts_with(content, E'Pedido de pagamento · TESTE\n'), false)
       or public.wallet_chat_allowed(conversation_id));