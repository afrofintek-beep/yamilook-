-- TEMPORARY TEST TEARDOWN ONLY. Target kvnbqqektpkeouyepyor.
-- Removes only this run's helper, context, pilot grants and temporary admin.
-- Does not alter or delete journals, financial entries or gateway observations.
do $cleanup$
declare c massa_test_harness.concurrent_probe; test_admin uuid;
begin
 if not exists(select 1 from massa_test_harness.installation where singleton and target_project='kvnbqqektpkeouyepyor') then
  raise exception 'Wrong test harness target';
 end if;
 select * into strict c from massa_test_harness.concurrent_probe where singleton;
 if c.merchant<>'MASSA_STRICT_a37da1b90bf6' or c.finished_at is null
  or c.prepare_calls<>2 or c.confirm_calls<>2 then raise exception 'Strict probe has not completed'; end if;
 if (select count(*) from auth.users u join public.profiles p on p.id=u.id where
   (u.id=c.actor_id and u.email='massa-db-a37da1b90bf6-buyer@example.invalid' and p.username='massa_db_a37da1b90bf6_buyer')
   or (u.id=c.seller_id and u.email='massa-db-a37da1b90bf6-seller@example.invalid' and p.username='massa_db_a37da1b90bf6_seller'))<>2 then
  raise exception 'Synthetic participant identity check failed';
 end if;
 if exists(select 1 from auth.users where id in(c.actor_id,c.seller_id)
    and (coalesce(encrypted_password,'')<>'' or phone is not null))
  or exists(select 1 from auth.identities where user_id in(c.actor_id,c.seller_id)) then
  raise exception 'Participants unexpectedly have authentication credentials';
 end if;
 select u.id into strict test_admin from auth.users u join public.profiles p on p.id=u.id
  where u.email='massa-db-a37da1b90bf6-admin@example.invalid' and p.username='massa_db_a37da1b90bf6_admin';
 delete from public.wallet_pilot_access where user_id in(c.actor_id,c.seller_id) and granted_by=test_admin;
 delete from public.user_roles where user_id=test_admin and role='admin';
 delete from auth.users where id=test_admin and email='massa-db-a37da1b90bf6-admin@example.invalid';
 -- Referential integrity retains two synthetic identities; remove the dummy
 -- email identifiers as well. Neither identity has a password, phone or OAuth.
 update auth.users set email=null where id in(c.actor_id,c.seller_id);
end;
$cleanup$;

drop function public.massa_test_probe(text);
drop table massa_test_harness.concurrent_probe;
