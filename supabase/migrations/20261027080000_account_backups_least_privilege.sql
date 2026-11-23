-- Least privilege: the caller's Storage RLS now restricts attributed usage.
-- Run after 20261027062000_account_backups.sql. Never apply this file alone
-- to an environment missing the account backup baseline.
ALTER FUNCTION public.my_attributed_storage_usage() SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.my_attributed_storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_attributed_storage_usage() TO authenticated;
