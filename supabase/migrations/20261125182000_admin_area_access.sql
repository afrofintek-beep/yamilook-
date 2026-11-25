-- Extend the existing policy evaluator. Old clients retain their four-feature API.
alter table integration_access_private.policies drop constraint policies_feature_check;
alter table integration_access_private.policies add constraint policies_feature_check check (feature in (
 'google_maps','maguela','wallet','business_registration',
 'admin_campaigns','admin_trusted_invites','admin_creators','admin_monetization',
 'admin_addresses','admin_certifications','admin_payouts','admin_test_data'
));
insert into integration_access_private.policies(feature) values
 ('admin_campaigns'),('admin_trusted_invites'),('admin_creators'),('admin_monetization'),
 ('admin_addresses'),('admin_certifications'),('admin_payouts'),('admin_test_data');
-- Moderators already review local certifications. Represent that existing permission explicitly.
update integration_access_private.policies set mode='criteria',
 criteria='{"role":"moderator","groupIds":[],"minAccountAgeDays":0}'
 where feature='admin_certifications';
insert into integration_access_private.audit(action,after_value)
 values('legacy_import','{"administrativeAreas":8,"certificationModeratorsPreserved":true}');

create function integration_access_private.area_granted(p_actor uuid,p_area text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_area in ('admin_campaigns','admin_trusted_invites','admin_creators','admin_monetization',
   'admin_addresses','admin_certifications','admin_payouts','admin_test_data')
   and exists(select 1 from auth.users where id=p_actor and deleted_at is null
     and (banned_until is null or banned_until<=now()))
   and coalesce((integration_access_private.decision(p_actor,p_area)->>'allowed')::boolean,false)
$$;
revoke all on function integration_access_private.area_granted(uuid,text) from public,anon,authenticated;

-- Used by RLS and administrative operations with the caller's actual session.
create function public.admin_area_allowed(p_area text) returns boolean
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then return false; end if;
 perform public.account_current_session_id();
 return integration_access_private.area_granted(auth.uid(),p_area);
end $$;
revoke all on function public.admin_area_allowed(text) from public,anon;
grant execute on function public.admin_area_allowed(text) to authenticated;

create function public.admin_area_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform public.account_current_session_id();
 if not integration_access_private.active_account(auth.uid()) then raise exception 'Active account required' using errcode='42501'; end if;
 select jsonb_object_agg(feature,integration_access_private.area_granted(auth.uid(),feature)) into result
 from integration_access_private.policies where feature like 'admin\_%' escape '\';
 return jsonb_build_object('userId',auth.uid(),'admin',public.has_role(auth.uid(),'admin'),'areas',result);
end $$;
revoke all on function public.admin_area_status() from public,anon;
grant execute on function public.admin_area_status() to authenticated;

create function public.access_dashboard_manage_v2(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
 select integration_access_private.dashboard_manage(p_action,p_data)
$$;
revoke all on function public.access_dashboard_manage_v2(text,jsonb) from public,anon;
grant execute on function public.access_dashboard_manage_v2(text,jsonb) to authenticated;

create function integration_access_private.legacy_dashboard(p_action text,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; field text;
begin
 result:=integration_access_private.dashboard_manage(p_action,p_data);
 if p_action='dashboard' then
   foreach field in array array['policies','overrides','audit'] loop
     result:=jsonb_set(result,array[field],coalesce((select jsonb_agg(value) from jsonb_array_elements(result->field)
       where value->>'feature' is null or value->>'feature' in ('google_maps','maguela','wallet','business_registration')),'[]'));
   end loop;
 elsif p_action='preview' then
   select coalesce(jsonb_agg(value),'[]') into result from jsonb_array_elements(result)
    where value->>'feature' in ('google_maps','maguela','wallet','business_registration');
 end if;
 return result;
end $$;
revoke all on function integration_access_private.legacy_dashboard(text,jsonb) from public,anon;
grant execute on function integration_access_private.legacy_dashboard(text,jsonb) to authenticated;
create or replace function public.access_dashboard_manage(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$
 select integration_access_private.legacy_dashboard(p_action,p_data)
$$;
