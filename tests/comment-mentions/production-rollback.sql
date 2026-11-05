-- Run after applying comment_mentions_privacy. This creates no durable users,
-- credentials or posts; every synthetic row is rolled back. No emails are sent.
BEGIN;
DO $$
DECLARE
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  private_post uuid := gen_random_uuid(); public_post uuid := gen_random_uuid();
  code text := upper(replace(gen_random_uuid()::text, '-', ''));
  n integer;
BEGIN
  INSERT INTO public.mvp_candidates(full_name,email,status,access_code,code_used)
  VALUES ('Mention rollback fixture', a::text || '@yamilook.test', 'approved', code, false);
  INSERT INTO auth.users(id,email,raw_user_meta_data)
  VALUES (a,a::text || '@yamilook.test',jsonb_build_object('access_code',code)),
         (b,b::text || '@yamilook.test',jsonb_build_object('access_code',code));
  INSERT INTO public.posts(id,user_id,privacy,content)
  VALUES (private_post,a,'only_me','Synthetic private fixture'),
         (public_post,a,'everyone','Synthetic public fixture');
  INSERT INTO public.post_comments(post_id,user_id,content)
  VALUES (private_post,a,'@synthetic_recipient'),(public_post,a,'@synthetic_recipient');
  PERFORM set_config('request.jwt.claim.sub',b::text,true);
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM public.posts WHERE id=private_post) THEN RAISE EXCEPTION 'Private post visible'; END IF;
  IF EXISTS(SELECT 1 FROM public.post_comments WHERE post_id=private_post) THEN RAISE EXCEPTION 'Private comment leaked'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.post_comments WHERE post_id=public_post) THEN RAISE EXCEPTION 'Public mention missing'; END IF;
  INSERT INTO public.post_comments(post_id,user_id,content) VALUES(public_post,b,'Authorized recipient reply');
  BEGIN
    INSERT INTO public.post_comments(post_id,user_id,content) VALUES(private_post,b,'Unauthorized write');
    RAISE EXCEPTION 'Unauthorized comment write allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;
  INSERT INTO public.blocked_users(blocker_id,blocked_id) VALUES(a,b);
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM public.post_comments WHERE post_id=public_post) THEN RAISE EXCEPTION 'Blocked mention leaked'; END IF;
  RESET ROLE;
  PERFORM set_config('yamilook.mention_test','PASS: private denial, public read/write, forbidden write, reverse block; synthetic fixture rolled back',true);
END $$;
SELECT current_setting('yamilook.mention_test') AS result;
ROLLBACK;
