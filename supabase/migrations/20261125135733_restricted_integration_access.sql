-- Visibility of Google Maps / MAGUELA is independent of wallet invitations.
-- No existing profile is enrolled. Active administrators have automatic access.
create schema integration_access_private;
revoke all on schema integration_access_private from public, anon, authenticated;
grant usage on schema integration_access_private to authenticated;

create table integration_access_private.grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('google_maps', 'maguela')),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table integration_access_private.grants enable row level security;
revoke all on integration_access_private.grants from public, anon, authenticated;
create policy integration_access_rpc_only on integration_access_private.grants
  as restrictive for all to authenticated using (false) with check (false);
create index integration_access_granted_by on integration_access_private.grants(granted_by);

-- This private definer is the only writer. The public RPC remains an invoker.
-- Each request checks the live session, account and server-owned administrator role.
create function integration_access_private.manage(
  p_action text default 'status', p_user_id uuid default null, p_feature text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  administrator boolean;
  result jsonb;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform public.account_current_session_id();
  if not exists (
    select 1 from auth.users u join public.profiles p on p.id = u.id
    where u.id = caller and u.is_anonymous is not true and p.account_status::text = 'active'
  ) then
    raise exception 'Active account required' using errcode = '42501';
  end if;
  administrator := public.has_role(caller, 'admin');

  if p_action = 'status' then
    if p_user_id is not null or p_feature is not null then
      raise exception 'Invalid request' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'userId', caller, 'admin', administrator,
      'googleMaps', administrator or exists (
        select 1 from integration_access_private.grants where user_id = caller and feature = 'google_maps'
      ),
      'maguela', administrator or exists (
        select 1 from integration_access_private.grants where user_id = caller and feature = 'maguela'
      )
    );
  end if;

  if administrator is not true then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  if p_action = 'list' then
    if p_user_id is not null or p_feature is not null then
      raise exception 'Invalid request' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId', x.user_id, 'username', coalesce(x.username, ''),
      'displayName', coalesce(x.display_name, ''),
      'googleMaps', x.google_maps, 'maguela', x.maguela
    ) order by x.username, x.user_id), '[]'::jsonb)
    into result from (
      select g.user_id, p.username, p.display_name,
        bool_or(g.feature = 'google_maps') as google_maps,
        bool_or(g.feature = 'maguela') as maguela
      from integration_access_private.grants g join public.profiles p on p.id = g.user_id
      group by g.user_id, p.username, p.display_name
    ) x;
    return result;
  end if;

  if p_action is null or p_action not in ('grant', 'revoke') or p_user_id is null
    or p_feature is null or p_feature not in ('google_maps', 'maguela') then
    raise exception 'Invalid request' using errcode = '22023';
  end if;
  if p_action = 'grant' then
    if not exists (
      select 1 from public.profiles p join auth.users u on u.id = p.id
      where p.id = p_user_id and p.account_status::text = 'active' and u.is_anonymous is not true
    ) then
      raise exception 'Active profile required' using errcode = '22023';
    end if;
    insert into integration_access_private.grants(user_id, feature, granted_by)
    values (p_user_id, p_feature, caller)
    on conflict (user_id, feature) do update set granted_by = excluded.granted_by, granted_at = now();
  else
    delete from integration_access_private.grants where user_id = p_user_id and feature = p_feature;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function integration_access_private.manage(text, uuid, text) from public, anon, authenticated;
grant execute on function integration_access_private.manage(text, uuid, text) to authenticated;

create function public.integration_access_manage(
  p_action text default 'status', p_user_id uuid default null, p_feature text default null
) returns jsonb
language sql security invoker set search_path = ''
as $$ select integration_access_private.manage(p_action, p_user_id, p_feature) $$;
revoke all on function public.integration_access_manage(text, uuid, text) from public, anon, authenticated;
grant execute on function public.integration_access_manage(text, uuid, text) to authenticated;

comment on function public.integration_access_manage(text, uuid, text) is
  'Admin-managed menu visibility for Google Maps and MAGUELA in Yamilook and KOSOLOLA. Status is always for the current live account.';
