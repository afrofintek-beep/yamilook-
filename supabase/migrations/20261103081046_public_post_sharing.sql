-- Anonymous readers can access only explicitly public, unmoderated posts.
-- Existing authenticated policies and all post audiences are preserved.
BEGIN;
REVOKE SELECT ON public.posts FROM anon;
GRANT SELECT (id, user_id, type, content, media_urls, privacy, is_hidden, created_at)
  ON public.posts TO anon;
CREATE POLICY posts_public_read ON public.posts
  FOR SELECT TO anon
  USING (privacy = 'everyone' AND is_hidden = false);
COMMIT;
