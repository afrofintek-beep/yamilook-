create or replace function public.chat_inbox_summaries(p_conversation_ids uuid[])
returns table(conversation_id uuid, last_message jsonb, unread_count bigint)
language sql stable set search_path to ''
as $$
  select cp.conversation_id,
    to_jsonb(latest) || jsonb_build_object('latest_reaction', to_jsonb(reaction)),
    (select count(*) from public.visible_messages m
      where m.conversation_id = cp.conversation_id
        and m.sender_id <> (select auth.uid()) and not coalesce(m.is_deleted, false)
        and (cp.last_read_at is null or m.created_at > cp.last_read_at))
  from public.conversation_participants cp
  left join lateral (
    select m.* from public.visible_messages m where m.conversation_id = cp.conversation_id
    order by m.created_at desc, m.id desc limit 1
  ) latest on true
  left join lateral (
    select r.user_id, r.created_at from public.message_reactions r
    join public.visible_messages m on m.id = r.message_id
    where m.conversation_id = cp.conversation_id and not coalesce(m.is_deleted, false)
      and r.created_at > latest.created_at
    order by r.created_at desc, r.id desc limit 1
  ) reaction on true
  where cp.user_id = (select auth.uid()) and not coalesce(cp.is_archived, false)
    and cp.conversation_id = any(p_conversation_ids)
$$;
