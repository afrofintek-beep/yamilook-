-- Close broad legacy voice access without deleting, moving or rewriting any file.
-- Public media originals require a separate, coordinated quarantine; RLS does not
-- protect the public object-serving endpoint of a public bucket.
create or replace function private.legacy_chat_voice_path(p_reference text)
returns text language plpgsql immutable security invoker set search_path='' as $$
declare encoded text; decoded bytea:=''::bytea; part text; path text;
begin
 encoded:=substring(p_reference from '^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/(?:public|sign|authenticated)/voice-messages/([^?#]+)');
 if encoded is null or regexp_replace(encoded,'%[0-9A-Fa-f]{2}','','g') like '%\%%' escape '\' then return null; end if;
 for part in select (regexp_matches(encoded,'%[0-9A-Fa-f]{2}|[^%]+','g'))[1] loop
  decoded:=decoded || case when left(part,1)='%' then decode(substr(part,2),'hex') else convert_to(part,'UTF8') end;
 end loop;
 path:=convert_from(decoded,'UTF8');
 if path='' or path ~ '[[:cntrl:]?#]' or path ~ '(^|/)([.][.]?|)(/|$)' then return null; end if;
 return path;
exception when others then return null;
end $$;
revoke all on function private.legacy_chat_voice_path(text) from public,anon;
grant execute on function private.legacy_chat_voice_path(text) to authenticated;

create or replace function private.can_read_legacy_chat_voice(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (
  exists(select 1 from public.chat_attachments a
   where a.legacy_bucket='voice-messages' and a.legacy_path=p_path
    and private.can_read_chat_attachment(a.object_path))
  or exists(select 1 from public.messages m
   join public.conversation_participants cp on cp.conversation_id=m.conversation_id and cp.user_id=auth.uid()
   where (private.legacy_chat_voice_path(m.media_url)=p_path or private.legacy_chat_voice_path(m.thumbnail_url)=p_path)
    and not coalesce(m.is_deleted,false) and (m.expires_at is null or m.expires_at>now())
    and (cp.history_cleared_at is null or m.created_at>cp.history_cleared_at)
    and not exists(select 1 from public.hidden_messages h where h.message_id=m.id and h.user_id=auth.uid() and h.is_hidden))
 );
$$;
revoke all on function private.can_read_legacy_chat_voice(text) from public,anon;
grant execute on function private.can_read_legacy_chat_voice(text) to authenticated;

drop policy if exists "Authenticated users can view voice messages" on storage.objects;
create policy legacy_voice_participant_read on storage.objects for select to authenticated
 using(bucket_id='voice-messages' and private.can_read_legacy_chat_voice(name));
-- Restrictive gates prevent a broad permissive policy from reopening this bucket.
create policy legacy_voice_read_boundary on storage.objects as restrictive for select to authenticated
 using(bucket_id<>'voice-messages' or private.can_read_legacy_chat_voice(name));
create policy legacy_voice_anonymous_boundary on storage.objects as restrictive for select to anon
 using(bucket_id<>'voice-messages');
create policy legacy_voice_preserve_insert on storage.objects as restrictive for insert to anon,authenticated
 with check(bucket_id<>'voice-messages');
create policy legacy_voice_preserve_update on storage.objects as restrictive for update to anon,authenticated
 using(bucket_id<>'voice-messages') with check(bucket_id<>'voice-messages');
create policy legacy_voice_preserve_delete on storage.objects as restrictive for delete to anon,authenticated
 using(bucket_id<>'voice-messages');
update storage.buckets set public=false where id='voice-messages';

-- A guessed old voice URL must not create authorization by being posted into a
-- new conversation. Existing unchanged references remain usable on unrelated edits.
create or replace function private.check_legacy_chat_voice_references()
returns trigger language plpgsql security invoker set search_path='' as $$
declare column_name text; reference text; path text;
begin
 if auth.uid() is null then return new; end if;
 foreach column_name in array array['media_url','thumbnail_url'] loop
  reference:=to_jsonb(new)->>column_name;
  if tg_op='UPDATE' and reference is not distinct from to_jsonb(old)->>column_name then continue; end if;
  path:=private.legacy_chat_voice_path(reference);
  if path is not null and not private.can_read_legacy_chat_voice(path) then
   raise exception 'Attachment unavailable' using errcode='42501';
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.check_legacy_chat_voice_references() from public,anon,authenticated;
create trigger check_legacy_chat_voice_references before insert or update of media_url,thumbnail_url on public.messages
 for each row execute function private.check_legacy_chat_voice_references();
create trigger check_scheduled_legacy_voice_references before insert or update of media_url on public.scheduled_messages
 for each row execute function private.check_legacy_chat_voice_references();

-- Recipients cannot restore deleted/expired media or weaken sender-owned flags.
-- Compare every field except the explicit receipt allowlist, including future fields.
create or replace function public.messages_restrict_read_marking()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null and auth.jwt()->>'role'='service_role' then return new; end if;
 if auth.uid() is distinct from old.sender_id and
  (to_jsonb(new)-array['read_by','delivered_at','updated_at']) is distinct from
  (to_jsonb(old)-array['read_by','delivered_at','updated_at']) then
  raise exception 'Non-sender may only update read_by / delivered_at' using errcode='42501';
 end if;
 return new;
end $$;
notify pgrst,'reload schema';
