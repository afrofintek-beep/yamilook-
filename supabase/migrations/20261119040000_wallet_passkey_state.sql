create schema if not exists wallet_security;
revoke all on schema wallet_security from public, anon, authenticated;

create table wallet_security.credentials (
  credential_id text primary key,
  holder_id uuid not null references auth.users(id) on delete cascade,
  public_key bytea not null,
  sign_count bigint not null default 0 check (sign_count >= 0),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table wallet_security.challenges (
  challenge text primary key,
  holder_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  purpose text not null check (purpose in ('register', 'unlock', 'authorize')),
  operation jsonb,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  check ((purpose = 'authorize') = (operation is not null))
);

-- Called only after the server verifies the WebAuthn response.
-- Bind consumption to the exact operation and authenticated session.
create function wallet_security.consume_challenge(
  p_challenge text, p_holder uuid, p_session uuid, p_purpose text, p_operation jsonb
) returns boolean
language sql
set search_path = ''
as $$
  with consumed as (
    delete from wallet_security.challenges
    where challenge = p_challenge and holder_id = p_holder
      and session_id = p_session and purpose = p_purpose
      and operation is not distinct from p_operation
      and expires_at > clock_timestamp()
    returning 1
  )
  select exists (select from consumed);
$$;

revoke all on all tables in schema wallet_security from public, anon, authenticated;
revoke all on all functions in schema wallet_security from public, anon, authenticated;
