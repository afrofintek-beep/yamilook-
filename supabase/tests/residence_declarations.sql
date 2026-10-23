begin;
create temp table residence_fixture as
select p.id as owner, (select q.id from public.profiles q where q.id<>p.id and not public.is_moderator_or_admin(q.id) limit 1) as outsider,
 coalesce(b.name,p.neighborhood,'Talatona') as neighborhood,coalesce(b.city,p.city,'Luanda') as city,
 coalesce(p.country_code,'AO') as country,ub.activated_at
from public.profiles p left join public.user_bandas ub on ub.user_id=p.id and ub.is_active
left join public.bandas b on b.id=ub.banda_id where not public.is_moderator_or_admin(p.id) limit 1;
grant select on residence_fixture to authenticated;
set local role authenticated;
do $$ declare f record;r jsonb;begin
 select * into f from residence_fixture;assert f.owner is not null and f.outsider is not null;
 perform set_config('request.jwt.claim.sub',f.owner::text,true);
 r:=public.submit_residence_declaration('away',f.country,f.city,f.neighborhood);
 assert r->>'status'='declared';
 assert (select latitude is null and longitude is null and afroloc_code is null from public.profiles where id=f.owner),'away must never retain a home GPS';
 assert not public.can_receive_banda_benefits(f.owner),'declaration cannot unlock territorial money';
 begin
  update public.residence_declarations set method='home' where user_id=f.owner;
  raise exception 'client forged declaration';
 exception when insufficient_privilege then null;end;
 begin
  update public.profiles set afroloc_certification_status='certified' where id=f.owner;
  raise exception 'client self certified';
 exception when insufficient_privilege then null;end;
 r:=public.set_afroloc_certification(f.owner,true)::jsonb;assert r->>'error'='forbidden';
 perform set_config('request.jwt.claim.sub',f.outsider::text,true);
 assert not exists(select 1 from public.residence_declarations where user_id=f.owner),'another user read a private address';
 perform set_config('request.jwt.claim.sub',f.owner::text,true);
 r:=public.submit_residence_declaration('existing',f.country,f.city,f.neighborhood,'AO-LDA-TAL-G10-TEST-CLAIM');
 assert r->>'status'='pending';assert not public.can_receive_banda_benefits(f.owner),'a code alone cannot verify residence';
 r:=public.submit_residence_declaration('home',f.country,f.city,f.neighborhood,null,-8.9,13.2,20);
 assert r->>'status'='pending' and r->>'address_code' is not null;
 assert not public.can_receive_banda_benefits(f.owner),'one GPS reading cannot certify a residence';
 if f.activated_at is not null then
 assert (select activated_at=f.activated_at from public.user_bandas where user_id=f.owner and is_active),'reconfirming same Banda must not reset tenure';end if;
end $$;
reset role;
do $$ declare u uuid;blocked boolean:=false;begin
 select owner into u from residence_fixture;
 begin
 insert into public.kumbu_ledger(user_id,amount,action_type,source,balance_after)values(u,1,'earn','territorial',0);
 exception when raise_exception then blocked:=true;end;
 assert blocked,'territorial award accepted before residence validation';
 -- Simulate an authorized certification decision, then an address change.
 update public.profiles set afroloc_certification_status='certified' where id=u;
 assert public.can_receive_banda_benefits(u),'authority decision should unlock eligible Banda';
 update public.profiles set latitude=latitude+0.001 where id=u;
 assert not public.can_receive_banda_benefits(u),'a changed address reused its previous certificate';
end $$;
rollback;
