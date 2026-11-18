-- Deferred checks run after the RPC returns, under the caller role.
-- Read the complete journal despite owner-only RLS; return no ledger data.
alter function payment_point_private.check_balance() security definer;
alter function payment_point_private.check_balance() set search_path='';
revoke all on function payment_point_private.check_balance() from public, anon, authenticated;
