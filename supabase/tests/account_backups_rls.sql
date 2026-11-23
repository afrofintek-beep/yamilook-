-- Run in disposable Supabase preview only, with the account-backups migration applied.
-- The test creates no Auth users and makes no persistent changes (ROLLBACK).
BEGIN;
INSERT INTO storage.buckets(id,name,public) VALUES ('backup-test-fixtures','backup-test-fixtures',false);
INSERT INTO storage.objects(bucket_id,name,owner_id,metadata) VALUES
('account-backups','11111111-1111-4111-8111-111111111111/snapshot-1000-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.json','11111111-1111-4111-8111-111111111111','{"size":100,"mimetype":"application/json"}'::jsonb),
('account-backups','22222222-2222-4222-8222-222222222222/snapshot-1001-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.json','22222222-2222-4222-8222-222222222222','{"size":200,"mimetype":"application/json"}'::jsonb),
('media','11111111-1111-4111-8111-111111111111/photo.jpg','11111111-1111-4111-8111-111111111111','{"size":512,"mimetype":"image/jpeg"}'::jsonb),
('media','22222222-2222-4222-8222-222222222222/photo.jpg','22222222-2222-4222-8222-222222222222','{"size":256,"mimetype":"image/jpeg"}'::jsonb),
('media','legacy/photo.jpg',NULL,'{"size":7777,"mimetype":"image/jpeg"}'::jsonb);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $test$
DECLARE n integer; u jsonb;
BEGIN
 SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='account-backups';
 IF n<>1 THEN RAISE EXCEPTION 'A can read foreign backup'; END IF;
 SELECT public.my_attributed_storage_usage() INTO u;
 IF (u->>'bytes')::integer<>512 OR (u->>'photos')::integer<>512
 THEN RAISE EXCEPTION 'Invalid attributed storage %',u; END IF;
 BEGIN
   INSERT INTO storage.objects(bucket_id,name,metadata)
   VALUES('account-backups','22222222-2222-4222-8222-222222222222/foreign.json','{}');
   RAISE EXCEPTION 'Foreign upload accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
 BEGIN
   INSERT INTO storage.objects(bucket_id,name,metadata)
   VALUES('account-backups','11111111-1111-4111-8111-111111111111/bad.txt','{}');
   RAISE EXCEPTION 'Non-JSON extension accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $test$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
DO $test$ DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='account-backups';
 IF n<>1 THEN RAISE EXCEPTION 'B can read foreign backup'; END IF;
END $test$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $test$ DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM storage.objects WHERE bucket_id='account-backups';
 IF n<>0 THEN RAISE EXCEPTION 'Anonymous read allowed'; END IF;
 IF has_function_privilege('anon','public.my_attributed_storage_usage()','EXECUTE')
 THEN RAISE EXCEPTION 'Anonymous RPC allowed'; END IF;
END $test$;
SELECT 'PASS: owner isolation, non-JSON/foreign writes blocked, invoker usage scoped, anonymous access denied' AS result;
ROLLBACK;
