-- Comments must never disclose a post that the caller cannot read.
-- The private helper only checks blocks involving the current authenticated
-- caller, including reverse blocks hidden by blocked_users' own RLS.
CREATE OR REPLACE FUNCTION private.comment_actor_visible(p_actor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = '' AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.blocked_users b
    WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = p_actor)
       OR (b.blocked_id = (SELECT auth.uid()) AND b.blocker_id = p_actor)
  );
$$;
REVOKE ALL ON FUNCTION private.comment_actor_visible(uuid) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.comment_actor_visible(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.post_comments;
CREATE POLICY "Read comments on accessible posts" ON public.post_comments
FOR SELECT TO anon, authenticated USING (
  NOT is_hidden
  AND private.comment_actor_visible(user_id)
  AND EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id
      AND NOT p.is_hidden AND private.comment_actor_visible(p.user_id)
  )
);

-- Apply the same parent boundary on writes, in addition to the existing
-- author ownership checks. Restrictive policies cannot be bypassed by OR-ing
-- another permissive INSERT/UPDATE policy.
CREATE POLICY "Comment insert requires accessible post" ON public.post_comments
AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (
  NOT is_hidden AND EXISTS (
    SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id
      AND NOT p.is_hidden AND private.comment_actor_visible(p.user_id)
  )
);
CREATE POLICY "Comment update requires accessible post" ON public.post_comments
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id
    AND NOT p.is_hidden AND private.comment_actor_visible(p.user_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id
    AND NOT p.is_hidden AND private.comment_actor_visible(p.user_id)
));
