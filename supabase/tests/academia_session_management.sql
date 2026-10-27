-- All fixtures, balance movements, notices and schema changes can be rolled back.
-- Execute after the migration inside BEGIN/ROLLBACK.
create temp table academy_management_fixture as
 select gen_random_uuid() session_id, gen_random_uuid() empty_id, ids[1] mentor,ids[2] learner,ids[3] outsider
 from (select array_agg(id order by created_at) ids from public.profiles) p;
grant select on academy_management_fixture to authenticated;
insert into public.academia_sessions(id,mentor_id,title,scheduled_at,status,price_coins)
 select session_id,mentor,'[TRANSACTION TEST] lifecycle',now()+interval '1 day','scheduled',10 from academy_management_fixture;
insert into public.academia_sessions(id,mentor_id,title,scheduled_at,status,price_coins)
 select empty_id,mentor,'[TRANSACTION TEST] empty',now()-interval '1 day','scheduled',0 from academy_management_fixture;
insert into public.academia_reservations(session_id,user_id,status,price_paid)
 select session_id,learner,'reserved',10 from academy_management_fixture;
insert into public.kumbu_ledger(user_id,amount,action_type,source,reference_id,description)
 select learner,-10,'spend','academia',session_id,'[TRANSACTION TEST] retained payment' from academy_management_fixture;
set local role authenticated;
do $$ declare f record; r jsonb; initial_balance integer; final_balance integer; begin
 select * into f from academy_management_fixture;
 perform set_config('request.jwt.claim.sub',f.outsider::text,true);
 begin
  perform public.academia_manage_session(f.session_id,'cancel','Teste');
  raise exception 'Unauthorized cancellation accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.academia_manage_session(f.session_id,'archive');
  raise exception 'Unauthenticated archive accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',f.mentor::text,true);
 begin
  update public.academia_sessions set status='cancelled' where id=f.session_id;
  raise exception 'Direct cancellation accepted';
 exception when raise_exception then if sqlerrm<>'Use session management' then raise; end if; end;
 begin
  perform public.academia_manage_session(f.session_id,'delete');
  raise exception 'Deleted booked session';
 exception when raise_exception then if sqlerrm<>'Esta sessão tem histórico. Arquive-a.' then raise; end if; end;
 begin
  perform public.academia_manage_session(f.session_id,'archive');
  raise exception 'Archived future session';
 exception when raise_exception then if sqlerrm<>'Only past or closed sessions can be archived' then raise; end if; end;
 update public.academia_sessions set scheduled_at=now()-interval '1 day' where id=f.session_id;
 begin
  perform public.academia_manage_session(f.session_id,'archive');
  raise exception 'Archived unsettled bookings';
 exception when raise_exception then if sqlerrm<>'Conclua ou cancele a sessão antes de arquivar as inscrições pendentes' then raise; end if; end;
 begin
  perform public.academia_manage_session(f.session_id,'cancel','');
  raise exception 'Accepted missing reason';
 exception when raise_exception then if sqlerrm<>'Indique o motivo (3 a 1000 caracteres)' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',f.learner::text,true);
 select kumbu_available into initial_balance from public.profiles where id=f.learner;
 perform set_config('request.jwt.claim.sub',f.mentor::text,true);
 perform public.academia_manage_session(f.session_id,'cancel','Indisponibilidade do mentor');
 perform public.academia_manage_session(f.session_id,'cancel','Repeated request');
 perform public.academia_manage_session(f.session_id,'archive');
 perform public.academia_manage_session(f.session_id,'restore');
 r:=public.academia_complete(f.session_id);
 assert r->>'reason'='closed','Cancelled session cannot pay mentor';
 perform set_config('request.jwt.claim.sub',f.learner::text,true);
 select kumbu_available into final_balance from public.profiles where id=f.learner;
 assert final_balance=coalesce(initial_balance,0)+10,'Refund must happen exactly once';
 assert (select count(*) from public.academia_session_notices where session_id=f.session_id)=1,'Learner receives notice once';
 assert (select refunded from public.academia_session_notices where session_id=f.session_id)=10,'Notice includes refund';
 assert (public.kumbu_refund(f.session_id,'academia','Repeated refund')->>'refunded')::integer=0,'Direct refund cannot duplicate organizer refund';
 r:=public.academia_reserve(f.session_id);
 assert r->>'reason'='closed','Cancelled session cannot be booked';
 perform set_config('request.jwt.claim.sub',f.outsider::text,true);
 assert (select count(*) from public.academia_session_notices where session_id=f.session_id)=0,'Notice privacy';
 perform set_config('request.jwt.claim.sub',f.mentor::text,true);
 perform public.academia_manage_session(f.empty_id,'archive');
 perform public.academia_manage_session(f.empty_id,'restore');
 perform public.academia_manage_session(f.empty_id,'delete');
 assert not exists(select 1 from public.academia_sessions where id=f.empty_id),'Deleted session hidden by RLS';
end $$;
reset role;
insert into public.user_roles(user_id,role) select outsider,'admin' from academy_management_fixture on conflict do nothing;
set local role authenticated;
do $$ declare f record; begin
 select * into f from academy_management_fixture;
 perform set_config('request.jwt.claim.sub',f.outsider::text,true);
 perform public.academia_manage_session(f.session_id,'archive');
 perform public.academia_manage_session(f.session_id,'restore');
 assert (select count(*) from public.academia_session_actions where session_id=f.session_id)>=5,'Admin can read the audit trail';
end $$;
reset role;
do $$ begin
 assert not has_function_privilege('anon','public.academia_manage_session(uuid,text,text)','EXECUTE'),'Anonymous mutation forbidden';
 assert not has_function_privilege('authenticated','private.academia_reserve(uuid)','EXECUTE'),'Cannot bypass serialization wrapper';
 assert not has_table_privilege('authenticated','public.academia_session_notices','INSERT'),'Cannot forge a notice';
end $$;
select 'Academia lifecycle SQL assertions passed' as result;
