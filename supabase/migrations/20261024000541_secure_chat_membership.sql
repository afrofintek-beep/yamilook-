-- Membership is an authorization boundary, never a user-editable preference.
-- Existing membership/roles are preserved; no production conversation is rewritten.
create or replace function public.create_chat_conversation(
 p_participant_ids uuid[], p_group_name text default null, p_avatar_url text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); peers uuid[]; result public.conversations; is_group boolean;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if cardinality(p_participant_ids) is null or cardinality(p_participant_ids) not between 1 and 255
 or array_position(p_participant_ids,null) is not null then raise exception 'Invalid participants'; end if;
 select array_agg(distinct u order by u) into peers from unnest(p_participant_ids) u where u<>actor;
 if coalesce(cardinality(peers),0)=0 then raise exception 'Choose another participant'; end if;
 if (select count(*) from public.profiles where id=any(peers))<>cardinality(peers) then raise exception 'Participant unavailable'; end if;
 is_group:=cardinality(peers)>1 or nullif(btrim(p_group_name),'') is not null;
 if is_group and (nullif(btrim(p_group_name),'') is null or length(btrim(p_group_name))>100) then raise exception 'Invalid group name'; end if;
 if not is_group then
  -- Both directions of a concurrent direct-chat request share the same lock.
  perform pg_advisory_xact_lock(hashtextextended(least(actor::text,peers[1]::text)||':'||greatest(actor::text,peers[1]::text),0));
  select c.* into result from public.conversations c
  where c.type='direct' and exists(select 1 from public.conversation_participants cp where cp.conversation_id=c.id and cp.user_id=actor)
   and exists(select 1 from public.conversation_participants cp where cp.conversation_id=c.id and cp.user_id=peers[1])
   and (select count(*) from public.conversation_participants cp where cp.conversation_id=c.id)=2
  order by c.created_at,c.id limit 1;
  if found then return to_jsonb(result); end if;
 end if;
 insert into public.conversations(type,name,avatar_url,created_by)
 values(case when is_group then 'group' else 'direct' end,case when is_group then btrim(p_group_name) else null end,p_avatar_url,actor) returning * into result;
 insert into public.conversation_participants(conversation_id,user_id,role)
 values(result.id,actor,case when is_group then 'admin'::public.group_member_role else 'member'::public.group_member_role end);
 insert into public.conversation_participants(conversation_id,user_id,role)
 select result.id,u,'member'::public.group_member_role from unnest(peers) u;
 return to_jsonb(result);
end $$;
revoke all on function public.create_chat_conversation(uuid[],text,text) from public,anon;
grant execute on function public.create_chat_conversation(uuid[],text,text) to authenticated;

-- Remove all old permissive paths, including owner/self INSERT alternatives.
do $$ declare p record; begin
 for p in select tablename,policyname from pg_policies where schemaname='public'
 and tablename in ('conversation_participants','conversations','group_invites') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
revoke all on public.conversation_participants,public.conversations,public.group_invites from public,anon,authenticated;
-- Explicit column revocation also protects projects with previous column grants.
do $$ declare t text; cols text; begin
 foreach t in array array['conversation_participants','conversations','group_invites'] loop
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name=t;
  execute format('revoke insert (%s), update (%s), references (%s) on public.%I from public,anon,authenticated',cols,cols,cols,t);
 end loop;
end $$;
grant select,delete on public.conversation_participants to authenticated;
grant update(last_read_at,is_muted,is_pinned,is_archived,history_cleared_at) on public.conversation_participants to authenticated;
create policy chat_members_read on public.conversation_participants for select to authenticated using(public.user_is_participant(conversation_id));
create policy chat_members_preferences on public.conversation_participants for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy chat_members_leave on public.conversation_participants for delete to authenticated using(user_id=auth.uid());

grant select on public.conversations to authenticated;
grant update(disappearing_messages_duration) on public.conversations to authenticated;
create policy chat_read on public.conversations for select to authenticated using(public.user_is_participant(id));
create policy chat_settings on public.conversations for update to authenticated
 using(public.user_is_participant(id) and (type='direct' or public.is_group_admin(auth.uid(),id)))
 with check(public.user_is_participant(id) and (type='direct' or public.is_group_admin(auth.uid(),id)));

grant select,delete on public.group_invites to authenticated;
grant insert(conversation_id,code,created_by,expires_at,max_uses) on public.group_invites to authenticated;
grant update(is_active,expires_at,max_uses) on public.group_invites to authenticated;
create policy chat_invites_read on public.group_invites for select to authenticated using(public.is_group_admin(auth.uid(),conversation_id));
create policy chat_invites_create on public.group_invites for insert to authenticated
 with check(created_by=auth.uid() and public.is_group_admin(auth.uid(),conversation_id)
 and exists(select 1 from public.conversations c where c.id=conversation_id and c.type='group')
 and (max_uses is null or max_uses>0) and (expires_at is null or expires_at>now()));
create policy chat_invites_update on public.group_invites for update to authenticated
 using(public.is_group_admin(auth.uid(),conversation_id)) with check(public.is_group_admin(auth.uid(),conversation_id) and (max_uses is null or max_uses>0));
create policy chat_invites_delete on public.group_invites for delete to authenticated using(public.is_group_admin(auth.uid(),conversation_id));

-- Preview by possession of a valid code, without exposing the invite directory.
create or replace function public.preview_chat_invite(invite_code text) returns json
language plpgsql security definer set search_path='' as $$
declare i public.group_invites; c public.conversations;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into i from public.group_invites where code=invite_code and is_active and (expires_at is null or expires_at>now()) and (max_uses is null or uses_count<max_uses);
 if not found then return json_build_object('success',false,'error','Convite inválido ou expirado'); end if;
 select * into c from public.conversations where id=i.conversation_id and type='group';
 if not found or not public.is_group_admin(i.created_by,i.conversation_id) then return json_build_object('success',false,'error','Convite indisponível'); end if;
 return json_build_object('success',true,'conversation_id',c.id,'name',c.name,'avatar_url',c.avatar_url,'member_count',(select count(*) from public.conversation_participants where conversation_id=c.id));
end $$;
revoke all on function public.preview_chat_invite(text) from public,anon;
grant execute on function public.preview_chat_invite(text) to authenticated;

create or replace function public.use_group_invite(invite_code text) returns json
language plpgsql security definer set search_path='' as $$
declare i public.group_invites; actor uuid:=auth.uid();
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into i from public.group_invites where code=invite_code for update;
 if not found or not i.is_active or (i.expires_at is not null and i.expires_at<=now()) then return json_build_object('success',false,'error','Convite inválido ou expirado'); end if;
 perform 1 from public.conversations where id=i.conversation_id and type='group' for update;
 if not found or not public.is_group_admin(i.created_by,i.conversation_id) then return json_build_object('success',false,'error','Convite indisponível'); end if;
 if exists(select 1 from public.conversation_participants where conversation_id=i.conversation_id and user_id=actor) then
  return json_build_object('success',true,'already_member',true,'conversation_id',i.conversation_id);
 end if;
 if (i.max_uses is not null and i.uses_count>=i.max_uses) or (select count(*) from public.conversation_participants where conversation_id=i.conversation_id)>=256 then return json_build_object('success',false,'error','Limite do convite ou grupo atingido'); end if;
 insert into public.conversation_participants(conversation_id,user_id,role) values(i.conversation_id,actor,'member');
 update public.group_invites set uses_count=uses_count+1 where id=i.id;
 return json_build_object('success',true,'already_member',false,'conversation_id',i.conversation_id);
end $$;
revoke all on function public.use_group_invite(text) from public,anon;
grant execute on function public.use_group_invite(text) to authenticated;

-- Existing guarded group RPCs remain the only path for roles and membership.
revoke all on function public.add_group_member(uuid,uuid,public.group_member_role),public.remove_group_member(uuid,uuid),public.set_member_role(uuid,uuid,public.group_member_role),public.update_group_info(uuid,text,text) from public,anon;
grant execute on function public.add_group_member(uuid,uuid,public.group_member_role),public.remove_group_member(uuid,uuid),public.set_member_role(uuid,uuid,public.group_member_role),public.update_group_info(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
