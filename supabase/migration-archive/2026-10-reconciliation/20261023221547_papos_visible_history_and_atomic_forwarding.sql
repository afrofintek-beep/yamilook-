-- Clearing is a reversible, per-user display preference. No messages are deleted.
alter table public.conversation_participants add column if not exists history_cleared_at timestamptz;
create or replace function public.set_chat_history_cleared(p_conversation_id uuid, p_restore boolean default false)
returns timestamptz language plpgsql security invoker set search_path=public as $$
declare cutoff timestamptz := case when p_restore then null else clock_timestamp() end;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 update public.conversation_participants set history_cleared_at=cutoff
 where conversation_id=p_conversation_id and user_id=auth.uid();
 if not found then raise exception 'Conversation unavailable'; end if;
 return cutoff;
end;
$$;
revoke all on function public.set_chat_history_cleared(uuid,boolean) from public,anon;
grant execute on function public.set_chat_history_cleared(uuid,boolean) to authenticated;
create or replace view public.visible_messages with (security_invoker=true) as
 select m.* from public.messages m
 join public.conversation_participants cp on cp.conversation_id=m.conversation_id and cp.user_id=auth.uid()
 where (cp.history_cleared_at is null or m.created_at>cp.history_cleared_at)
 and (m.expires_at is null or m.expires_at>now())
 and not exists(select 1 from public.hidden_messages h where h.user_id=auth.uid() and h.message_id=m.id and h.is_hidden);
revoke all on public.visible_messages from public,anon;
grant select on public.visible_messages to authenticated;
notify pgrst, 'reload schema';
-- Forward actual, visible source records atomically. All destinations must belong to the caller.
create or replace function public.forward_chat_messages(p_message_ids uuid[], p_conversation_ids uuid[])
returns integer language plpgsql security invoker set search_path=public as $$
declare source_count integer; target_count integer; inserted_count integer;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select count(distinct x) into source_count from unnest(p_message_ids) x;
 select count(distinct x) into target_count from unnest(p_conversation_ids) x;
 if source_count not between 1 and 100 or target_count not between 1 and 20 then raise exception 'Invalid forwarding selection'; end if;
 if (select count(*) from public.visible_messages where id=any(p_message_ids) and not coalesce(is_deleted,false) and not coalesce(is_view_once,false) and (message_type='text' or media_url is not null))<>source_count then
  raise exception 'Some messages are unavailable or cannot be forwarded';
 end if;
 if (select count(*) from public.conversation_participants where user_id=auth.uid() and conversation_id=any(p_conversation_ids))<>target_count then
  raise exception 'Conversation unavailable';
 end if;
 insert into public.messages(conversation_id,sender_id,content,message_type,media_url,duration_seconds,forwarded_from_id,forwarded_from_user_id)
 select target.id,auth.uid(),m.content,m.message_type,m.media_url,m.duration_seconds,m.id,m.sender_id
 from public.visible_messages m cross join (select distinct unnest(p_conversation_ids) as id) target
 where m.id=any(p_message_ids) order by m.created_at;
 get diagnostics inserted_count=row_count;
 return inserted_count;
end;
$$;
revoke all on function public.forward_chat_messages(uuid[],uuid[]) from public,anon;
grant execute on function public.forward_chat_messages(uuid[],uuid[]) to authenticated;
notify pgrst, 'reload schema';
