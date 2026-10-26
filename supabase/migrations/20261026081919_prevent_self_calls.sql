-- create_call already rejects self-calls. Enforce the same invariant for direct
-- writes too. NOT VALID preserves historical data while checking new/updated rows.
ALTER TABLE public.calls ADD CONSTRAINT calls_distinct_recipient
  CHECK (callee_id IS NULL OR
    (callee_id IS DISTINCT FROM caller_id AND callee_id IS DISTINCT FROM initiator_id))
  NOT VALID;
ALTER TABLE public.call_signals ADD CONSTRAINT call_signals_distinct_users
  CHECK (from_user_id IS DISTINCT FROM to_user_id) NOT VALID;
-- Validate historical rows only after reviewing any existing violations; do not
-- delete user call history as part of deployment.
