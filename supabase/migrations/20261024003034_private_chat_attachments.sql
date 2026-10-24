create table public.chat_attachments (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id),
 uploader_id uuid not null, object_path text not null unique, created_at timestamptz not null default now(),
 legacy_bucket text, legacy_path text, legacy_shared boolean not null default false, legacy_quarantined boolean not null default false, unique(legacy_bucket,legacy_path)
);
alter table public.chat_attachments enable row level security;
revoke all on public.chat_attachments from public,anon,authenticated;
grant all on public.chat_attachments to service_role;
create policy chat_attachment_registry_service on public.chat_attachments for all to service_role using(true) with check(true);
create index chat_attachments_conversation_idx on public.chat_attachments(conversation_id);
create index chat_messages_media_ref_idx on public.messages(media_url) where media_url like 'chat-attachment://%';
create index chat_messages_poster_ref_idx on public.messages(thumbnail_url) where thumbnail_url like 'chat-attachment://%';
insert into storage.buckets(id,name,public,file_size_limit) values('chat-attachments','chat-attachments',false,104857600)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

create or replace function private.can_read_chat_attachment(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
 select 1 from public.chat_attachments a where a.object_path=p_path and (
  (a.legacy_bucket is null and a.uploader_id=auth.uid() and a.created_at>now()-interval '1 hour'
   and exists(select 1 from public.conversation_participants cp where cp.conversation_id=a.conversation_id and cp.user_id=auth.uid())
   and not exists(select 1 from public.messages m where m.media_url='chat-attachment://'||a.object_path or m.thumbnail_url='chat-attachment://'||a.object_path))
  or exists(select 1 from public.messages m join public.conversation_participants cp on cp.conversation_id=m.conversation_id and cp.user_id=auth.uid()
   where (m.media_url='chat-attachment://'||a.object_path or m.thumbnail_url='chat-attachment://'||a.object_path)
    and not coalesce(m.is_deleted,false) and (m.expires_at is null or m.expires_at>now())
    and (cp.history_cleared_at is null or m.created_at>cp.history_cleared_at)
    and not exists(select 1 from public.hidden_messages h where h.message_id=m.id and h.user_id=auth.uid() and h.is_hidden))
 ));
$$;
create or replace function private.can_upload_chat_attachment(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.chat_attachments a
 join public.conversation_participants cp on cp.conversation_id=a.conversation_id and cp.user_id=auth.uid()
 where a.object_path=p_path and a.legacy_bucket is null and a.uploader_id=auth.uid() and a.created_at>now()-interval '1 hour');
$$;
revoke all on function private.can_read_chat_attachment(text),private.can_upload_chat_attachment(text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.can_read_chat_attachment(text),private.can_upload_chat_attachment(text) to authenticated;
create policy chat_attachment_upload on storage.objects for insert to authenticated
 with check(bucket_id='chat-attachments' and private.can_upload_chat_attachment(name));
create policy chat_attachment_read on storage.objects for select to authenticated
 using(bucket_id='chat-attachments' and private.can_read_chat_attachment(name));
-- No client UPDATE/move/delete path on private objects; messages govern availability.

create or replace function public.reserve_chat_attachment(p_conversation_id uuid,p_filename text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.chat_attachments; actor uuid:=auth.uid(); filename text;
begin
 if actor is null or not exists(select 1 from public.conversation_participants where conversation_id=p_conversation_id and user_id=actor) then raise exception 'Conversation unavailable' using errcode='42501'; end if;
 filename:=left(regexp_replace(coalesce(p_filename,'file'),'[^a-zA-Z0-9._-]','_','g'),160);
 if filename in ('','.','..') then filename:='file'; end if;
 a.id:=gen_random_uuid();a.conversation_id:=p_conversation_id;a.uploader_id:=actor;
 a.object_path:=p_conversation_id::text||'/'||actor::text||'/'||a.id::text||'/'||filename;
 insert into public.chat_attachments(id,conversation_id,uploader_id,object_path) values(a.id,a.conversation_id,a.uploader_id,a.object_path);
 return jsonb_build_object('path',a.object_path,'reference','chat-attachment://'||a.object_path);
end $$;
revoke all on function public.reserve_chat_attachment(uuid,text) from public,anon;
grant execute on function public.reserve_chat_attachment(uuid,text) to authenticated;

-- Knowing a private path must not grant access by inserting that path in another chat.
create or replace function private.check_chat_attachment_references() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ref text; path text;
begin
 if auth.uid() is null then return new; end if; -- service maintenance has no user identity; RLS denies anonymous writes.
 foreach ref in array array[new.media_url,to_jsonb(new)->>'thumbnail_url'] loop
  if ref like 'chat-attachment://%' then
   path:=substr(ref,length('chat-attachment://')+1);
   if not private.can_read_chat_attachment(path) and not private.can_upload_chat_attachment(path) then
    raise exception 'Attachment unavailable' using errcode='42501';
   end if;
  elsif ref ~ '/storage/v1/object/(public|sign|authenticated)/(media|voice-messages)/' then
   raise exception 'Public chat uploads are no longer accepted; reload the application' using errcode='42501';
  elsif ref like '%/storage/v1/object/%/chat-attachments/%' then
   raise exception 'Use a private attachment reference' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.check_chat_attachment_references() from public,anon;
create trigger check_chat_attachment_references before insert or update of media_url,thumbnail_url on public.messages
for each row execute function private.check_chat_attachment_references();
create trigger check_scheduled_chat_attachment_references before insert or update of media_url on public.scheduled_messages
for each row execute function private.check_chat_attachment_references();

-- Legacy private audio no longer has account-wide read permission. New audio uses chat-attachments.
drop policy if exists "Authenticated users can view voice messages" on storage.objects;
drop policy if exists "Authenticated users can upload voice messages" on storage.objects;
-- Public social files remain in media. Only private chat uploads use the new bucket.
notify pgrst,'reload schema';

-- Maintenance inventory returns URL fields only, never message text or credentials.
create or replace function public.chat_media_external_references() returns setof text
language plpgsql security definer set search_path='' as $$
declare c record;
begin
 for c in select cols.table_name,cols.column_name,cols.data_type from information_schema.columns cols
 join pg_catalog.pg_class t on t.relname=cols.table_name join pg_catalog.pg_namespace n on n.oid=t.relnamespace and n.nspname=cols.table_schema
 where cols.table_schema='public' and t.relkind='r' and cols.table_name not in ('messages','scheduled_messages')
 and cols.column_name ~ '(url|uri|path)' and cols.data_type in ('text','ARRAY') loop
  if c.data_type='ARRAY' then
   return query execute format('select unnest(%I)::text from public.%I where %I is not null',c.column_name,c.table_name,c.column_name);
  else
   return query execute format('select %I::text from public.%I where %I is not null',c.column_name,c.table_name,c.column_name);
  end if;
 end loop;
end $$;
revoke all on function public.chat_media_external_references() from public,anon,authenticated;
grant execute on function public.chat_media_external_references() to service_role;

-- Authenticated sender/recipient checks remain; verified service maintenance can rewrite URLs.
create or replace function public.messages_restrict_read_marking() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null and auth.jwt()->>'role'='service_role' then return new; end if;
 if auth.uid() is distinct from old.sender_id then
  if new.content is distinct from old.content or new.sender_id is distinct from old.sender_id
   or new.conversation_id is distinct from old.conversation_id or new.message_type is distinct from old.message_type
   or new.media_url is distinct from old.media_url or new.reply_to_id is distinct from old.reply_to_id then
   raise exception 'Non-sender may only update read_by / delivered_at';
  end if;
 end if;
 return new;
end $$;
