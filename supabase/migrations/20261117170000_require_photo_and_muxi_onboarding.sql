-- Enforce setup completion on the server; existing completed accounts stay valid.
CREATE OR REPLACE FUNCTION public.require_profile_completion()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.onboarding_completed = true AND (TG_OP = 'INSERT' OR OLD.onboarding_completed IS DISTINCT FROM true) THEN
    IF NEW.gender IS NULL OR NEW.birthday IS NULL OR nullif(trim(NEW.city),'') IS NULL
       OR nullif(trim(NEW.neighborhood),'') IS NULL OR nullif(trim(NEW.avatar_url),'') IS NULL THEN
      RAISE EXCEPTION 'Complete your profile, including a profile photo, before finishing setup';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'avatars'
      AND split_part(o.name, '/', 1) = NEW.id::text
      AND NEW.avatar_url LIKE '%/storage/v1/object/public/avatars/' || o.name) THEN
      RAISE EXCEPTION 'Upload a profile photo before finishing setup';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.posts WHERE user_id = NEW.id) THEN
      RAISE EXCEPTION 'Publish your first Muxi post before finishing setup';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS require_profile_completion ON public.profiles;
CREATE TRIGGER require_profile_completion BEFORE INSERT OR UPDATE OF onboarding_completed ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.require_profile_completion();

-- The profile lock serializes retries; the post and completion commit together.
CREATE OR REPLACE FUNCTION public.complete_muxi_onboarding(p_content text, p_privacy text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_completed boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT onboarding_completed INTO v_completed FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
  IF v_completed THEN RETURN; END IF;
  IF p_content IS NULL OR length(btrim(p_content)) = 0 OR length(p_content) > 2000 THEN
    RAISE EXCEPTION 'Write your first Muxi post (1–2000 characters)';
  END IF;
  IF p_privacy IS NULL OR p_privacy NOT IN ('contacts', 'everyone', 'only_me') THEN
    RAISE EXCEPTION 'Choose a valid audience';
  END IF;
  INSERT INTO public.posts(user_id, type, content, privacy)
  VALUES(auth.uid(), 'text', btrim(p_content), p_privacy);
  UPDATE public.profiles SET onboarding_completed = true WHERE id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.complete_muxi_onboarding(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_muxi_onboarding(text,text) TO authenticated;
