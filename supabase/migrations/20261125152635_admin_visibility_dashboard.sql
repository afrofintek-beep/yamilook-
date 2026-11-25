-- A single policy decision for navigation, wallet eligibility and business creation.
-- Existing per-operation ownership, debit authorization and approval workflows remain.
create table integration_access_private.policies (
  feature text primary key check (feature in ('google_maps','maguela','wallet','business_registration')),
  mode text not null default 'selected' check (mode in ('admins','selected','criteria','all')),
  enabled boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  criteria jsonb not null default '{"role":"any","groupIds":[],"minAccountAgeDays":0}',
  revision bigint not null default 1,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or ends_at > starts_at)
);
create table integration_access_private.overrides (
  feature text not null references integration_access_private.policies(feature),
  user_id uuid not null references auth.users(id) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  expires_at timestamptz,
  note text not null default '' check (length(note) <= 500),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (feature,user_id)
);
create table integration_access_private.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index access_group_unique_name on integration_access_private.groups(lower(name));
create table integration_access_private.group_members (
  group_id uuid not null references integration_access_private.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key(group_id,user_id)
);
create index access_groups_by_user on integration_access_private.group_members(user_id,group_id);
create table integration_access_private.audit (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  feature text references integration_access_private.policies(feature),
  target_id uuid references auth.users(id) on delete set null,
  action text not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);
create index access_audit_newest on integration_access_private.audit(created_at desc,id desc);
do $$ declare table_name text; begin
  foreach table_name in array array['policies','overrides','groups','group_members','audit'] loop
    execute format('alter table integration_access_private.%I enable row level security', table_name);
    execute format('revoke all on integration_access_private.%I from public,anon,authenticated', table_name);
    execute format('create policy access_rpc_only on integration_access_private.%I as restrictive for all to authenticated using(false) with check(false)', table_name);
  end loop;
end $$;
revoke all on all sequences in schema integration_access_private from public,anon,authenticated;

insert into integration_access_private.policies(feature) values
 ('google_maps'),('maguela'),('wallet'),('business_registration');
insert into integration_access_private.overrides(feature,user_id,effect,updated_by,updated_at)
 select feature,user_id,'allow',granted_by,granted_at from integration_access_private.grants
 on conflict do nothing;
insert into integration_access_private.overrides(feature,user_id,effect,updated_by,updated_at)
 select 'wallet',user_id,'allow',granted_by,granted_at from public.wallet_pilot_access
 on conflict do nothing;
insert into integration_access_private.overrides(feature,user_id,effect)
 select 'business_registration',user_id,'allow' from public.business_registration_access
 on conflict do nothing;
insert into integration_access_private.audit(action,after_value)
 values('legacy_import',jsonb_build_object('preservedOverrides',(select count(*) from integration_access_private.overrides)));

create function integration_access_private.active_account(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select p_user is not null and exists(
   select 1 from auth.users u join public.profiles p on p.id=u.id
   where u.id=p_user and u.is_anonymous is not true and p.account_status::text='active'
 )
$$;
revoke all on function integration_access_private.active_account(uuid) from public,anon,authenticated;

create function integration_access_private.decision(p_user uuid,p_feature text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
 policy integration_access_private.policies;
 exception integration_access_private.overrides;
 reason text := 'no_match'; permitted boolean := false;
 account_created timestamptz; required_role text; group_ids jsonb; min_days integer;
begin
 select * into policy from integration_access_private.policies where feature=p_feature;
 if not found then return jsonb_build_object('feature',p_feature,'allowed',false,'reason','invalid_feature'); end if;
 if not integration_access_private.active_account(p_user) then
   return jsonb_build_object('feature',p_feature,'allowed',false,'reason','inactive_account');
 end if;
 if public.has_role(p_user,'admin') then
   return jsonb_build_object('feature',p_feature,'allowed',true,'reason','admin');
 end if;
 if not policy.enabled then reason:='disabled';
 elsif policy.starts_at is not null and now()<policy.starts_at then reason:='not_started';
 elsif policy.ends_at is not null and now()>=policy.ends_at then reason:='expired';
 elsif policy.mode='admins' then reason:='admins_only';
 else
   select * into exception from integration_access_private.overrides
    where feature=p_feature and user_id=p_user and (expires_at is null or expires_at>now());
   if found then
     permitted:=exception.effect='allow'; reason:=case when permitted then 'explicit_allow' else 'explicit_deny' end;
   elsif policy.mode='all' then permitted:=true;reason:='all';
   elsif policy.mode='selected' and p_feature='business_registration' and exists(
     select 1 from public.mvp_candidates c join public.business_invitation_drafts d on d.candidate_id=c.id
     where c.code_used_by=p_user and c.code_used and c.status='approved'
   ) then permitted:=true;reason:='business_invitation';
   elsif policy.mode='criteria' then
     required_role:=policy.criteria->>'role'; group_ids:=policy.criteria->'groupIds';
     min_days:=(policy.criteria->>'minAccountAgeDays')::integer;
     select created_at into account_created from auth.users where id=p_user;
     permitted:=
       (required_role='any' or (required_role='moderator' and public.has_role(p_user,'moderator'))
         or (required_role='user' and not public.has_role(p_user,'moderator')))
       and (min_days=0 or account_created <= now()-make_interval(days=>min_days))
       and (jsonb_array_length(group_ids)=0 or exists(
         select 1 from integration_access_private.group_members m
         where m.user_id=p_user and group_ids ? m.group_id::text
       ));
     if permitted then reason:='criteria'; end if;
   end if;
 end if;
 return jsonb_build_object('feature',p_feature,'allowed',coalesce(permitted,false),'reason',reason);
end $$;
revoke all on function integration_access_private.decision(uuid,text) from public,anon,authenticated;

create function integration_access_private.valid_keys(value jsonb,allowed text[]) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(value)='object' and not exists(select 1 from jsonb_object_keys(value) k where not k=any(allowed))
$$;
revoke all on function integration_access_private.valid_keys(jsonb,text[]) from public,anon,authenticated;
create function integration_access_private.date_value(value jsonb) returns timestamptz
language plpgsql immutable set search_path='' as $$
declare s text;
begin
 if value is null or value='null'::jsonb then return null; end if;
 s:=value#>>'{}';
 if jsonb_typeof(value)<>'string' or length(s)>40 or s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}([.][0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
   raise exception 'Invalid date' using errcode='22023';
 end if;
 return s::timestamptz;
end $$;
revoke all on function integration_access_private.date_value(jsonb) from public,anon,authenticated;
create function integration_access_private.policy_json(policy integration_access_private.policies) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_object('feature',policy.feature,'mode',policy.mode,'enabled',policy.enabled,
   'startsAt',policy.starts_at,'endsAt',policy.ends_at,'criteria',policy.criteria,
   'revision',policy.revision,'updatedAt',policy.updated_at)
$$;
revoke all on function integration_access_private.policy_json(integration_access_private.policies) from public,anon,authenticated;

create function integration_access_private.dashboard_manage(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 caller uuid:=auth.uid(); administrator boolean; target uuid; v_group_id uuid;
 feature_name text; mode_name text; effect_name text; note_value text; query_value text; group_name text;
 criteria_value jsonb; begin_date timestamptz; end_date timestamptz; old_value jsonb; new_value jsonb;
 policy integration_access_private.policies; changed boolean; changed_rows integer; result jsonb;
begin
 if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
 perform public.account_current_session_id();
 if not integration_access_private.active_account(caller) then raise exception 'Active account required' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' then raise exception 'Invalid request' using errcode='22023'; end if;
 administrator:=public.has_role(caller,'admin');
 if p_action='status' then
   if p_data<>'{}'::jsonb then raise exception 'Invalid request' using errcode='22023'; end if;
   return jsonb_build_object('userId',caller,'admin',administrator,
    'googleMaps',(integration_access_private.decision(caller,'google_maps')->>'allowed')::boolean,
    'maguela',(integration_access_private.decision(caller,'maguela')->>'allowed')::boolean,
    'wallet',(integration_access_private.decision(caller,'wallet')->>'allowed')::boolean,
    'businessRegistration',(integration_access_private.decision(caller,'business_registration')->>'allowed')::boolean);
 end if;
 if administrator is not true then raise exception 'Administrator required' using errcode='42501'; end if;

 if p_action='dashboard' then
   if p_data<>'{}'::jsonb then raise exception 'Invalid request' using errcode='22023'; end if;
   return jsonb_build_object(
    'policies',(select coalesce(jsonb_agg(integration_access_private.policy_json(p) order by p.feature),'[]') from integration_access_private.policies p),
    'overrides',(select coalesce(jsonb_agg(jsonb_build_object('feature',o.feature,'userId',o.user_id,'effect',o.effect,
       'expiresAt',o.expires_at,'note',o.note,'username',coalesce(p.username,''),'displayName',coalesce(p.display_name,''))
       order by o.feature,p.username,o.user_id),'[]') from integration_access_private.overrides o join public.profiles p on p.id=o.user_id),
    'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'members',
       (select coalesce(jsonb_agg(jsonb_build_object('userId',m.user_id,'username',coalesce(p.username,''),'displayName',coalesce(p.display_name,''))
        order by p.username,m.user_id),'[]') from integration_access_private.group_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id))
        order by g.name,g.id),'[]') from integration_access_private.groups g),
    'audit',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id::text,'feature',a.feature,'action',a.action,
       'actorName',coalesce(p.display_name,p.username,''),'targetName',coalesce(t.display_name,t.username),
       'createdAt',a.created_at,'before',a.before_value,'after',a.after_value) order by a.created_at desc,a.id desc),'[]')
       from (select * from integration_access_private.audit order by created_at desc,id desc limit 100) a
       left join public.profiles p on p.id=a.actor_id left join public.profiles t on t.id=a.target_id)
   );
 elsif p_action='search_profiles' then
   if not integration_access_private.valid_keys(p_data,array['query']) or jsonb_typeof(p_data->'query') is distinct from 'string' then raise exception 'Invalid request' using errcode='22023'; end if;
   query_value:=lower(ltrim(trim(p_data->>'query'),'@'));
   if length(query_value)>120 or length(query_value)=1 then raise exception 'Invalid search' using errcode='22023'; end if;
   select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',coalesce(p.username,''),'displayName',coalesce(p.display_name,''),
     'isAdmin',public.has_role(p.id,'admin'),'isModerator',public.has_role(p.id,'moderator'),'createdAt',p.created_at) order by p.username,p.id),'[]') into result
   from (select p.id,p.username,p.display_name,u.created_at from public.profiles p join auth.users u on u.id=p.id
     where query_value='' or position(query_value in lower(coalesce(p.username,'')))>0 or position(query_value in lower(coalesce(p.display_name,'')))>0
     order by p.username,p.id limit 50) p;
   return result;
 elsif p_action='preview' then
   if not integration_access_private.valid_keys(p_data,array['userId']) or jsonb_typeof(p_data->'userId') is distinct from 'string' then raise exception 'Invalid request' using errcode='22023'; end if;
   target:=(p_data->>'userId')::uuid;
   if not exists(select 1 from public.profiles where id=target) then raise exception 'Unknown profile' using errcode='22023'; end if;
   select jsonb_agg(integration_access_private.decision(target,feature) order by feature) into result from integration_access_private.policies;
   return result;
 elsif p_action='save_policy' then
   if not integration_access_private.valid_keys(p_data,array['feature','mode','enabled','startsAt','endsAt','criteria','revision'])
     or not p_data ?& array['feature','mode','enabled','startsAt','endsAt','criteria','revision']
     or jsonb_typeof(p_data->'feature')<>'string' or jsonb_typeof(p_data->'mode')<>'string'
     or jsonb_typeof(p_data->'enabled')<>'boolean' or jsonb_typeof(p_data->'revision')<>'number'
     or p_data->>'revision' !~ '^[1-9][0-9]{0,15}$' then raise exception 'Invalid policy' using errcode='22023'; end if;
   feature_name:=p_data->>'feature';mode_name:=p_data->>'mode';criteria_value:=p_data->'criteria';
   if mode_name not in ('admins','selected','criteria','all') or not integration_access_private.valid_keys(criteria_value,array['role','groupIds','minAccountAgeDays'])
     or not criteria_value ?& array['role','groupIds','minAccountAgeDays']
     or jsonb_typeof(criteria_value->'role') is distinct from 'string' or criteria_value->>'role' not in ('any','moderator','user')
     or jsonb_typeof(criteria_value->'groupIds') is distinct from 'array'
     or jsonb_typeof(criteria_value->'minAccountAgeDays') is distinct from 'number'
     or criteria_value->>'minAccountAgeDays' !~ '^[0-9]{1,5}$' then raise exception 'Invalid criteria' using errcode='22023'; end if;
   if (criteria_value->>'minAccountAgeDays')::integer>36500 or jsonb_array_length(criteria_value->'groupIds')>50 then raise exception 'Invalid criteria' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(criteria_value->'groupIds') v where jsonb_typeof(v)<>'string'
     or not exists(select 1 from integration_access_private.groups g where g.id::text=v#>>'{}')) then raise exception 'Unknown group' using errcode='22023'; end if;
   if (select count(*) from jsonb_array_elements(criteria_value->'groupIds'))<>(select count(distinct value) from jsonb_array_elements(criteria_value->'groupIds')) then raise exception 'Duplicate group' using errcode='22023'; end if;
   if mode_name='criteria' and criteria_value->>'role'='any' and jsonb_array_length(criteria_value->'groupIds')=0 and (criteria_value->>'minAccountAgeDays')::integer=0 then raise exception 'Empty criteria' using errcode='22023'; end if;
   begin_date:=integration_access_private.date_value(p_data->'startsAt');end_date:=integration_access_private.date_value(p_data->'endsAt');
   if begin_date is not null and end_date is not null and end_date<=begin_date then raise exception 'Invalid period' using errcode='22023'; end if;
   select * into policy from integration_access_private.policies where feature=feature_name for update;
   if not found then raise exception 'Unknown feature' using errcode='22023'; end if;
   if policy.revision<>(p_data->>'revision')::bigint then raise exception 'Policy revision conflict' using errcode='40001'; end if;
   old_value:=integration_access_private.policy_json(policy);
   update integration_access_private.policies set mode=mode_name,enabled=(p_data->>'enabled')::boolean,
      starts_at=begin_date,ends_at=end_date,criteria=criteria_value,revision=revision+1,updated_by=caller,updated_at=now()
     where feature=feature_name returning * into policy;
   new_value:=integration_access_private.policy_json(policy);
   insert into integration_access_private.audit(actor_id,feature,action,before_value,after_value) values(caller,feature_name,'policy_saved',old_value,new_value);
 elsif p_action='set_override' then
   if not integration_access_private.valid_keys(p_data,array['feature','userId','effect','expiresAt','note'])
     or not p_data ?& array['feature','userId','effect','expiresAt','note']
     or jsonb_typeof(p_data->'feature')<>'string' or jsonb_typeof(p_data->'userId')<>'string'
     or jsonb_typeof(p_data->'effect')<>'string' or jsonb_typeof(p_data->'note')<>'string' then raise exception 'Invalid exception' using errcode='22023'; end if;
   feature_name:=p_data->>'feature';target:=(p_data->>'userId')::uuid;effect_name:=p_data->>'effect';note_value:=trim(p_data->>'note');
   end_date:=integration_access_private.date_value(p_data->'expiresAt');
   if not exists(select 1 from integration_access_private.policies where feature=feature_name)
     or not exists(select 1 from public.profiles where id=target) or effect_name not in ('allow','deny','inherit')
     or length(note_value)>500 or (end_date is not null and end_date<=now()) then raise exception 'Invalid exception' using errcode='22023'; end if;
   if effect_name='allow' and not integration_access_private.active_account(target) then raise exception 'Active profile required' using errcode='22023'; end if;
   if public.has_role(target,'admin') then raise exception 'Administrators have automatic access' using errcode='22023'; end if;
   perform pg_advisory_xact_lock(hashtextextended('access-override:'||feature_name||':'||target::text,0));
   select to_jsonb(o) into old_value from integration_access_private.overrides o where feature=feature_name and user_id=target;
   if effect_name='inherit' then
     delete from integration_access_private.overrides where feature=feature_name and user_id=target;
     new_value:=null;
   else
     insert into integration_access_private.overrides(feature,user_id,effect,expires_at,note,updated_by)
       values(feature_name,target,effect_name,end_date,note_value,caller)
       on conflict(feature,user_id) do update set effect=excluded.effect,expires_at=excluded.expires_at,note=excluded.note,updated_by=caller,updated_at=now();
     select to_jsonb(o) into new_value from integration_access_private.overrides o where feature=feature_name and user_id=target;
   end if;
   if old_value is distinct from new_value then
     insert into integration_access_private.audit(actor_id,feature,target_id,action,before_value,after_value)
       values(caller,feature_name,target,'override_'||effect_name,old_value,new_value);
   end if;
 elsif p_action='create_group' then
   if not integration_access_private.valid_keys(p_data,array['name']) or jsonb_typeof(p_data->'name') is distinct from 'string'
     or length(trim(p_data->>'name')) not between 1 and 80 then raise exception 'Invalid group' using errcode='22023'; end if;
   insert into integration_access_private.groups(name,created_by) values(trim(p_data->>'name'),caller) returning id into v_group_id;
   insert into integration_access_private.audit(actor_id,action,after_value) values(caller,'group_created',jsonb_build_object('id',v_group_id,'name',trim(p_data->>'name')));
 elsif p_action='set_group_member' then
   if not integration_access_private.valid_keys(p_data,array['groupId','userId','included'])
     or jsonb_typeof(p_data->'groupId') is distinct from 'string' or jsonb_typeof(p_data->'userId') is distinct from 'string'
     or jsonb_typeof(p_data->'included') is distinct from 'boolean' then raise exception 'Invalid membership' using errcode='22023'; end if;
   v_group_id:=(p_data->>'groupId')::uuid;target:=(p_data->>'userId')::uuid;changed:=(p_data->>'included')::boolean;
   select name into group_name from integration_access_private.groups where id=v_group_id;
   if not found or not exists(select 1 from public.profiles where id=target)
     or (changed and not integration_access_private.active_account(target)) then raise exception 'Invalid membership' using errcode='22023'; end if;
   if changed then
     insert into integration_access_private.group_members(group_id,user_id,added_by) values(v_group_id,target,caller) on conflict do nothing;
   else delete from integration_access_private.group_members m where m.group_id=v_group_id and m.user_id=target; end if;
   get diagnostics changed_rows=row_count;
   if changed_rows>0 then insert into integration_access_private.audit(actor_id,target_id,action,before_value,after_value)
     values(caller,target,case when changed then 'group_member_added' else 'group_member_removed' end,
       jsonb_build_object('groupId',v_group_id,'groupName',group_name,'included',not changed),
       jsonb_build_object('groupId',v_group_id,'groupName',group_name,'included',changed)); end if;
 else raise exception 'Invalid action' using errcode='22023';
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function integration_access_private.dashboard_manage(text,jsonb) from public,anon,authenticated;
grant execute on function integration_access_private.dashboard_manage(text,jsonb) to authenticated;
create function public.access_dashboard_manage(p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select integration_access_private.dashboard_manage(p_action,p_data)$$;
revoke all on function public.access_dashboard_manage(text,jsonb) from public,anon,authenticated;
grant execute on function public.access_dashboard_manage(text,jsonb) to authenticated;

-- Keep existing consumers and RLS on the same evaluator.
create or replace function payment_point_private.wallet_access_allowed(p_user uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (integration_access_private.decision(p_user,'wallet')->>'allowed')::boolean
$$;
create or replace function public.has_business_registration_access() returns boolean
language sql stable security definer set search_path='' as $$
 select (integration_access_private.decision(auth.uid(),'business_registration')->>'allowed')::boolean
$$;

-- Compatibility RPCs delegate all writes to the audited dashboard. Revoke means deny,
-- so it still removes access if the global policy is later set to all or criteria.
create or replace function integration_access_private.manage(p_action text default 'status',p_user_id uuid default null,p_feature text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_action='status' then
   if p_user_id is not null or p_feature is not null then raise exception 'Invalid request' using errcode='22023'; end if;
   return integration_access_private.dashboard_manage('status','{}');
 end if;
 if p_action in ('grant','revoke') then
   if p_feature is null or p_feature not in ('google_maps','maguela') then raise exception 'Invalid feature' using errcode='22023'; end if;
   return integration_access_private.dashboard_manage('set_override',jsonb_build_object('feature',p_feature,'userId',p_user_id,
     'effect',case when p_action='grant' then 'allow' else 'deny' end,'expiresAt',null,'note',''));
 end if;
 if p_action='list' and p_user_id is null and p_feature is null then
   perform integration_access_private.dashboard_manage('dashboard','{}');
   select coalesce(jsonb_agg(jsonb_build_object('userId',x.user_id,'username',coalesce(x.username,''),'displayName',coalesce(x.display_name,''),
     'googleMaps',x.google_maps,'maguela',x.maguela) order by x.username,x.user_id),'[]') into result
    from (select o.user_id,p.username,p.display_name,bool_or(o.feature='google_maps') google_maps,bool_or(o.feature='maguela') maguela
      from integration_access_private.overrides o join public.profiles p on p.id=o.user_id
      where o.feature in ('google_maps','maguela') and o.effect='allow' and (o.expires_at is null or o.expires_at>now())
      group by o.user_id,p.username,p.display_name) x;
   return result;
 end if;
 raise exception 'Invalid action' using errcode='22023';
end $$;

create or replace function public.wallet_pilot_manage(p_action text default 'status',p_identifier text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb; status jsonb;
begin
 if p_action='status' then
   status:=integration_access_private.dashboard_manage('status','{}');
   return jsonb_build_object('allowed',status->'wallet','admin',status->'admin');
 end if;
 perform integration_access_private.dashboard_manage('dashboard','{}');
 if p_action in ('grant','revoke') then
   select p.id into target from public.profiles p join auth.users u on u.id=p.id
    where lower(p.username)=lower(ltrim(trim(p_identifier),'@')) or lower(u.email)=lower(trim(p_identifier)) or p.id::text=trim(p_identifier) limit 1;
   if target is null then raise exception 'Unknown profile' using errcode='22023'; end if;
   perform integration_access_private.dashboard_manage('set_override',jsonb_build_object('feature','wallet','userId',target,
     'effect',case when p_action='grant' then 'allow' else 'deny' end,'expiresAt',null,'note',''));
 elsif p_action is distinct from 'list' then raise exception 'Invalid action' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',o.user_id,'name',coalesce(p.display_name,''),'username',coalesce(p.username,''),'granted_at',o.updated_at)
    order by o.updated_at desc),'[]') into result from integration_access_private.overrides o join public.profiles p on p.id=o.user_id
    where o.feature='wallet' and o.effect='allow' and (o.expires_at is null or o.expires_at>now());
 return result;
end $$;

-- Legacy direct writes remain compatible, but legacy tables are no longer a second
-- source of decisions. Their existing RLS and the live administrator/session checks
-- below control client writes; service/postgres maintenance has no auth.uid().
create function integration_access_private.mirror_legacy_grant() returns trigger
language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); feature_name text; target uuid; old_value jsonb; new_value jsonb;
begin
 feature_name:=case tg_table_name when 'wallet_pilot_access' then 'wallet' else 'business_registration' end;
 target:=case when tg_op='DELETE' then old.user_id else new.user_id end;
 if not exists(select 1 from auth.users where id=target) then return old; end if;
 if caller is not null then
   perform public.account_current_session_id();
   if not integration_access_private.active_account(caller) or not public.has_role(caller,'admin') then
     raise exception 'Active administrator required' using errcode='42501';
   end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('access-override:'||feature_name||':'||target::text,0));
 select to_jsonb(o) into old_value from integration_access_private.overrides o where feature=feature_name and user_id=target;
 insert into integration_access_private.overrides(feature,user_id,effect,updated_by)
  values(feature_name,target,case when tg_op='DELETE' then 'deny' else 'allow' end,caller)
  on conflict(feature,user_id) do update set effect=excluded.effect,expires_at=null,note='',updated_by=excluded.updated_by,updated_at=now();
 select to_jsonb(o) into new_value from integration_access_private.overrides o where feature=feature_name and user_id=target;
 insert into integration_access_private.audit(actor_id,feature,target_id,action,before_value,after_value)
  values(caller,feature_name,target,case when tg_op='DELETE' then 'override_deny' else 'override_allow' end,old_value,new_value);
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function integration_access_private.mirror_legacy_grant() from public,anon,authenticated;
create trigger dashboard_wallet_legacy after insert or delete on public.wallet_pilot_access
 for each row execute function integration_access_private.mirror_legacy_grant();
create trigger dashboard_business_legacy after insert or delete on public.business_registration_access
 for each row execute function integration_access_private.mirror_legacy_grant();

comment on function public.access_dashboard_manage(text,jsonb) is
 'Central administrator dashboard: feature policies, individual exceptions, groups, preview and audited changes. Does not assign administrator roles or replace financial/mentor/invitation safeguards.';
