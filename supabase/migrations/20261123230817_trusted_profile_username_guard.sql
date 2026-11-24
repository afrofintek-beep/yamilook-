begin;

-- Trusted accounts use the current profile username for login and recovery.
-- Keep that identifier representable by those flows without changing legacy
-- accounts or rewriting the user's chosen capitalization.
create function private.trusted_profile_username_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from private.trusted_accounts where user_id=OLD.id)
    and coalesce(lower(btrim(NEW.username)),'') !~ '^[a-z0-9][a-z0-9_]{2,19}$' then
    raise exception using errcode='23514', message='TRUSTED_USERNAME_INVALID';
  end if;
  return NEW;
end;
$$;

revoke all on function private.trusted_profile_username_guard() from public,anon,authenticated;

create trigger trusted_profile_username_guard
  before update of username on public.profiles
  for each row execute function private.trusted_profile_username_guard();

commit;
