-- Run as postgres against the migrated database. All fixtures and writes roll back.
-- No notifications or realtime events from these conversations are committed.
begin;
do $$
declare
  users uuid[];
  a uuid;
  b uuid;
  outsider uuid;
  source uuid := gen_random_uuid();
  target_one uuid := gen_random_uuid();
  target_two uuid := gen_random_uuid();
  forbidden_target uuid := gen_random_uuid();
  old_message uuid := gen_random_uuid();
  new_message uuid := gen_random_uuid();
  video_message uuid := gen_random_uuid();
  once_message uuid := gen_random_uuid();
  expired_message uuid := gen_random_uuid();
  deleted_message uuid := gen_random_uuid();
  pending_upload uuid := gen_random_uuid();
  invalid_source uuid;
  blocked boolean;
begin
  select array_agg(id) into users from (select id from public.profiles order by id limit 3) fixtures;
  assert cardinality(users) = 3, 'Three existing profiles are required';
  a := users[1]; b := users[2]; outsider := users[3];
  assert not has_table_privilege('anon', 'public.visible_messages', 'SELECT'), 'Anonymous view access';
  assert not has_function_privilege('anon', 'public.forward_chat_messages(uuid[],uuid[])', 'EXECUTE'), 'Anonymous forwarding';
  assert not has_function_privilege('anon', 'public.set_chat_history_cleared(uuid,boolean)', 'EXECUTE'), 'Anonymous clearing';

  insert into public.conversations(id, type, created_by)
  values (source,'direct',a),(target_one,'group',a),(target_two,'direct',a),(forbidden_target,'direct',outsider);
  insert into public.conversation_participants(conversation_id,user_id)
  values (source,a),(source,b),(target_one,a),(target_one,b),(target_two,a),(forbidden_target,outsider);
  insert into public.messages(id,conversation_id,sender_id,content)
  values(old_message,source,b,'Synthetic history fixture');

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',a::text,true);
  assert (select count(*) from public.visible_messages where conversation_id=source) = 1, 'Initial visibility';
  perform public.set_chat_history_cleared(source);
  assert (select count(*) from public.visible_messages where conversation_id=source) = 0, 'History did not clear';
  assert (select count(*) from public.messages where conversation_id=source) = 1, 'Clearing deleted physical messages';

  perform set_config('request.jwt.claim.sub',b::text,true);
  assert (select count(*) from public.visible_messages where conversation_id=source) = 1, 'Clearing affected another participant';
  insert into public.messages(id,conversation_id,sender_id,content,created_at)
  values(new_message,source,b,'New synthetic message',clock_timestamp());
  perform set_config('request.jwt.claim.sub',a::text,true);
  assert (select count(*) from public.visible_messages where conversation_id=source) = 1, 'New messages hidden by cutoff';
  perform public.set_chat_history_cleared(source,true);
  assert (select count(*) from public.visible_messages where conversation_id=source) = 2, 'Restore failed';

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  assert (select count(*) from public.visible_messages where conversation_id=source) = 0, 'Outsider can read messages';
  blocked := false;
  begin
    perform public.set_chat_history_cleared(source);
  exception when others then blocked := true;
  end;
  assert blocked, 'Outsider can clear participant history';

  reset role;
  insert into public.messages(id,conversation_id,sender_id,content,message_type,media_url,duration_seconds,is_view_once,expires_at,is_deleted)
  values
    (video_message,source,b,'fixture.mp4','video','https://example.invalid/fixture.mp4',13,false,null,false),
    (once_message,source,b,'once','image','https://example.invalid/once.jpg',null,true,null,false),
    (expired_message,source,b,'expired','text',null,null,false,now()-interval '1 hour',false),
    (deleted_message,source,b,'deleted','text',null,null,false,null,true),
    (pending_upload,source,b,null,'voice',null,5,false,null,false);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',a::text,true);
  insert into public.hidden_messages(user_id,message_id) values(a,old_message);
  assert not exists(select 1 from public.visible_messages where id=old_message), 'Hidden message reappeared';
  assert not exists(select 1 from public.visible_messages where id=expired_message), 'Expired message reappeared';
  assert public.forward_chat_messages(array[video_message],array[target_one,target_two]) = 2, 'Forwarding count';
  assert (select count(*) from public.messages where conversation_id in (target_one,target_two)
    and id<>video_message and sender_id=a and forwarded_from_id=video_message and forwarded_from_user_id=b
    and content='fixture.mp4' and message_type='video' and media_url='https://example.invalid/fixture.mp4'
    and duration_seconds=13) = 2, 'Forwarding lost attachment metadata';

  foreach invalid_source in array array[old_message,once_message,expired_message,deleted_message,pending_upload,gen_random_uuid()]
  loop
    blocked := false;
    begin
      perform public.forward_chat_messages(array[video_message,invalid_source],array[target_one]);
    exception when others then blocked := true;
    end;
    assert blocked, 'Unavailable source was forwarded';
  end loop;
  blocked := false;
  begin
    perform public.forward_chat_messages(array[video_message],array[target_two,forbidden_target]);
  exception when others then blocked := true;
  end;
  assert blocked, 'Outsider destination accepted';
  assert (select count(*) from public.messages where conversation_id in (target_one,target_two)) = 2,
    'Failed forwarding partially delivered messages';

  perform set_config('request.jwt.claim.sub',b::text,true);
  assert exists(select 1 from public.visible_messages where id=old_message), 'Hiding affected another participant';
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  blocked := false;
  begin
    perform public.forward_chat_messages(array[video_message],array[forbidden_target]);
  exception when others then blocked := true;
  end;
  assert blocked, 'Outsider can forward unreadable source';
  reset role;
end;
$$;
rollback;
select 'Papos history, isolation, restore and atomic media forwarding passed; fixtures rolled back' as result;
