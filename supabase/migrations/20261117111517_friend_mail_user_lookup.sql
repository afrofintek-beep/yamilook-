-- The mail worker needs only the verified destination, never credentials or metadata.
grant select (id,email,email_confirmed_at) on auth.users to service_role;
