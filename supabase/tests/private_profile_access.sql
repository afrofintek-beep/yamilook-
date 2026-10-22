-- Run as the database owner. Existing fixture rows are read; every test write rolls back.
BEGIN;
SELECT set_config('test.profile_owner',(SELECT p.id::text FROM public.profiles p WHERE NOT public.has_role(p.id,'admin') LIMIT 1),true);
SELECT set_config('test.profile_admin',(SELECT user_id::text FROM public.user_roles WHERE role='admin' LIMIT 1),true);
SELECT set_config('test.profile_other',(SELECT id::text FROM public.profiles WHERE id::text<>current_setting('test.profile_owner') LIMIT 1),true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',current_setting('test.profile_owner'),true);
DO $$
DECLARE n integer; v_other uuid:=current_setting('test.profile_other')::uuid;
BEGIN
 SELECT count(*) INTO n FROM public.profiles WHERE id=auth.uid();
 IF n<>1 THEN RAISE EXCEPTION 'Owner cannot read own full profile'; END IF;
 SELECT count(*) INTO n FROM public.profiles WHERE id=v_other;
 IF n<>0 THEN RAISE EXCEPTION 'Another private profile is exposed'; END IF;
 SELECT count(*) INTO n FROM public.public_profiles WHERE id=v_other;
 IF n<>1 THEN RAISE EXCEPTION 'Public social profile unavailable'; END IF;
 UPDATE public.profiles SET bio=bio WHERE id=auth.uid();
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION 'Owner cannot edit own biography'; END IF;
 UPDATE public.profiles SET bio=bio WHERE id=v_other;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Can edit another profile'; END IF;
 BEGIN
   UPDATE public.profiles SET kumbu_available=999999 WHERE id=auth.uid();
   RAISE EXCEPTION 'Owner can forge balance';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   UPDATE public.profiles SET is_creator=true WHERE id=auth.uid();
   RAISE EXCEPTION 'Owner can self-verify';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.generate_afroloc_code(v_other);
   RAISE EXCEPTION 'Other private address exposed by RPC';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   PERFORM public.update_profile_moderation(v_other,'{"account_status":"banned"}'::jsonb);
   RAISE EXCEPTION 'Member can moderate another user';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.profiles SET show_last_seen=false WHERE id=auth.uid();
 PERFORM public.renew_online_presence(gen_random_uuid(),true);
 IF EXISTS(SELECT 1 FROM public.public_profiles WHERE id=auth.uid() AND last_seen IS NOT NULL)
 OR EXISTS(SELECT 1 FROM public.profile_presence WHERE id=auth.uid() AND last_seen IS NOT NULL) THEN
   RAISE EXCEPTION 'Last-seen privacy ignored';
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('public_profiles','profile_presence')
 AND column_name IN ('email','phone_number','birthday','latitude','longitude','afroloc_code','kumbu_available','kyc_verified')) THEN
   RAISE EXCEPTION 'Private column included in public projection';
 END IF;
END $$;
SELECT set_config('request.jwt.claim.sub',current_setting('test.profile_admin'),true);
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.profiles WHERE id=current_setting('test.profile_owner')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'Administrator cannot read managed profile'; END IF;
 PERFORM public.update_profile_moderation(current_setting('test.profile_owner')::uuid,'{}'::jsonb);
 BEGIN
  PERFORM public.update_profile_moderation(current_setting('test.profile_owner')::uuid,'{"kumbu_available":999999}'::jsonb);
  RAISE EXCEPTION 'Moderation endpoint allows balance changes';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid moderation fields' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub','',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.profiles) THEN RAISE EXCEPTION 'Anonymous full profiles exposed'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: ownership, administrator access, public profiles, protected balances and verification flags, private location, moderation, anonymous access, and presence privacy' AS verification;
