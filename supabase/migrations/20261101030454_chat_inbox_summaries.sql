-- One preview and an exact unread count per conversation, never its full history.
-- Invoker rights and visible_messages preserve membership, hidden/expired messages
-- and each user's history cutoff. No new privilege to read messages is granted.
create index if not exists messages_conversation_created_id_idx
  on public.messages (conversation_id, created_at desc, id desc);

create or replace function public.chat_inbox_summaries(p_conversation_ids uuid[])
returns table (conversation_id uuid, last_message jsonb, unread_count bigint)
language sql stable security invoker set search_path = ''
as $$
  select cp.conversation_id,
    (select to_jsonb(m) from public.visible_messages m
      where m.conversation_id = cp.conversation_id
      order by m.created_at desc, m.id desc limit 1),
    (select count(*) from public.visible_messages m
      where m.conversation_id = cp.conversation_id
        and m.sender_id <> (select auth.uid())
        and not coalesce(m.is_deleted, false)
        and (cp.last_read_at is null or m.created_at > cp.last_read_at))
  from public.conversation_participants cp
  where cp.user_id = (select auth.uid())
    and not coalesce(cp.is_archived, false)
    and cp.conversation_id = any(p_conversation_ids);
$$;
revoke all on function public.chat_inbox_summaries(uuid[]) from public, anon;
grant execute on function public.chat_inbox_summaries(uuid[]) to authenticated;
