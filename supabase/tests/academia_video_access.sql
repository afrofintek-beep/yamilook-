begin;
create temp table academy_fixture as select gen_random_uuid() as session_id, ids[1] as mentor, ids[2] as learner, ids[3] as outsider from (select array_agg(id order by created_at) as ids from public.profiles) p;
grant select on academy_fixture to authenticated;
insert into public.academia_sessions(id,mentor_id,title,scheduled_at,status,price_coins) select session_id,mentor,'[TESTE TRANSACIONAL] Academia vídeo',now(),'scheduled',0 from academy_fixture;
insert into public.academia_reservations(session_id,user_id,status,price_paid) select session_id,learner,'reserved',0 from academy_fixture;
set local role authenticated;
do $$ declare f record; r jsonb; begin
 select * into f from academy_fixture;
 perform set_config('request.jwt.claim.sub',f.learner::text,true);
 r:=public.can_join_academia_room(f.session_id);
 assert r->>'reason'='not_live','scheduled room must reject joins';
 begin
   perform public.academia_set_live(f.session_id,true);
   raise exception 'non-mentor started the room';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',f.mentor::text,true);
 perform public.academia_set_live(f.session_id,true);
 r:=public.can_join_academia_room(f.session_id);
 assert (r->>'allowed')::boolean and (r->>'is_host')::boolean,'mentor must join as host';
 perform set_config('request.jwt.claim.sub',f.learner::text,true);
 r:=public.can_join_academia_room(f.session_id);
 assert (r->>'allowed')::boolean and not (r->>'is_host')::boolean,'reserved learner must join without host rights';
 perform set_config('request.jwt.claim.sub',f.outsider::text,true);
 r:=public.can_join_academia_room(f.session_id);
 assert not (r->>'allowed')::boolean,'unreserved user must be rejected';
 begin
  insert into public.academia_reservations(session_id,user_id) values(f.session_id,f.outsider);
  raise exception 'client forged a reservation';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',f.mentor::text,true);
 update public.academia_sessions set price_coins=10 where id=f.session_id;
 perform set_config('request.jwt.claim.sub',f.learner::text,true);
 r:=public.can_join_academia_room(f.session_id);
 assert not (r->>'allowed')::boolean,'paid session requires an authoritative debit';
 perform set_config('request.jwt.claim.sub',f.mentor::text,true);
 perform public.academia_set_live(f.session_id,false);
 r:=public.can_join_academia_room(f.session_id);
 assert r->>'reason'='not_live','closed session must reject joins';
 begin
  perform public.academia_set_live(f.session_id,true);
  raise exception 'closed session was reopened';
 exception when raise_exception then
  if sqlerrm <> 'session_closed' then raise; end if;
 end;
end $$;
reset role;
rollback;
