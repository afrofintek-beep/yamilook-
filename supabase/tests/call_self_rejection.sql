-- Existing production RPC protection. No real accounts or persistent records.
-- Run in an administrative SQL session; transaction always rolled back.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
DO $$
DECLARE kind text;
BEGIN
  FOREACH kind IN ARRAY ARRAY['voice', 'video'] LOOP
    BEGIN
      PERFORM public.create_call('00000000-0000-4000-8000-000000000001', kind);
      RAISE EXCEPTION 'Self-call unexpectedly accepted';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'Cannot call yourself' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;
ROLLBACK;

-- Constraint regression, isolated from production tables. Apply the migration's
-- CHECK expressions to temporary fixtures, including direct INSERT and UPDATE.
BEGIN;
CREATE TEMP TABLE call_guard_test (caller_id uuid, initiator_id uuid, callee_id uuid);
ALTER TABLE call_guard_test ADD CHECK (callee_id IS NULL OR
  (callee_id IS DISTINCT FROM caller_id AND callee_id IS DISTINCT FROM initiator_id)) NOT VALID;
CREATE TEMP TABLE signal_guard_test (from_user_id uuid, to_user_id uuid);
ALTER TABLE signal_guard_test ADD CHECK (from_user_id IS DISTINCT FROM to_user_id) NOT VALID;
DO $$
DECLARE a uuid := '00000000-0000-4000-8000-000000000001';
        b uuid := '00000000-0000-4000-8000-000000000002';
BEGIN
  INSERT INTO call_guard_test VALUES (a,a,b), (a,a,NULL);
  INSERT INTO signal_guard_test VALUES (a,b), (b,a);
  BEGIN
    INSERT INTO call_guard_test VALUES (a,a,a);
    RAISE EXCEPTION 'self-call insert accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE call_guard_test SET callee_id=a WHERE callee_id=b;
    RAISE EXCEPTION 'self-call update accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO signal_guard_test VALUES (a,a);
    RAISE EXCEPTION 'self-signal accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
