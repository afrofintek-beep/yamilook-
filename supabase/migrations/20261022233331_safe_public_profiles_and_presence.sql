-- Full profiles belong to the owner and administrators; social reads use a whitelist.
CREATE OR REPLACE VIEW public.public_profiles WITH (security_barrier=true) AS
SELECT p.id,p.display_name,p.username,p.avatar_url,p.bio,p.level,
 (coalesce(p.show_online_status,true) AND coalesce(p.is_online,false)
  AND p.last_seen > now()-interval '2 minutes') AS is_online,
 CASE WHEN p.show_last_seen IS DISTINCT FROM false THEN p.last_seen ELSE NULL END AS last_seen,
 p.status_message,p.created_at,p.updated_at,p.is_verified,p.is_creator,p.founder_number,
 p.profile_theme_color,p.show_online_status,p.show_last_seen,p.show_read_receipts,
 p.show_typing_indicators,p.photos_visibility
FROM public.profiles p;
-- This deliberately privileged view exposes only this fixed whitelist, never p.*.
REVOKE ALL ON public.public_profiles FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.public_profiles TO anon,authenticated;
-- Restricted profile rows must not be broadcast to social presence subscribers.
CREATE TABLE public.profile_presence (
 id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 is_online boolean NOT NULL DEFAULT false,
 last_seen timestamptz,
 show_online_status boolean NOT NULL DEFAULT true,
 show_last_seen boolean NOT NULL DEFAULT true,
 show_read_receipts boolean NOT NULL DEFAULT true,
 show_typing_indicators boolean NOT NULL DEFAULT true
);
ALTER TABLE public.profile_presence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read safe presence" ON public.profile_presence FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.profile_presence FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.profile_presence TO authenticated;
CREATE FUNCTION private.publish_safe_profile_presence()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.profile_presence(id,is_online,last_seen,show_online_status,show_last_seen,show_read_receipts,show_typing_indicators)
 VALUES (NEW.id,coalesce(NEW.is_online,false) AND coalesce(NEW.show_online_status,true),
 CASE WHEN NEW.show_last_seen IS DISTINCT FROM false THEN NEW.last_seen ELSE NULL END,
 coalesce(NEW.show_online_status,true),coalesce(NEW.show_last_seen,true),
 coalesce(NEW.show_read_receipts,true),coalesce(NEW.show_typing_indicators,true))
 ON CONFLICT(id) DO UPDATE SET is_online=excluded.is_online,last_seen=excluded.last_seen,
 show_online_status=excluded.show_online_status,show_last_seen=excluded.show_last_seen,
 show_read_receipts=excluded.show_read_receipts,show_typing_indicators=excluded.show_typing_indicators;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.publish_safe_profile_presence() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER publish_safe_profile_presence AFTER INSERT OR UPDATE OF is_online,last_seen,show_online_status,show_last_seen,show_read_receipts,show_typing_indicators
ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.publish_safe_profile_presence();
INSERT INTO public.profile_presence(id,is_online,last_seen,show_online_status,show_last_seen,show_read_receipts,show_typing_indicators)
 SELECT id,coalesce(is_online,false) AND coalesce(show_online_status,true),
 CASE WHEN show_last_seen IS DISTINCT FROM false THEN last_seen ELSE NULL END,
 coalesce(show_online_status,true),coalesce(show_last_seen,true),coalesce(show_read_receipts,true),coalesce(show_typing_indicators,true)
 FROM public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_presence;

CREATE OR REPLACE FUNCTION public.get_public_profiles_by_ids(p_ids uuid[])
RETURNS TABLE(id uuid,display_name text,username text,avatar_url text,bio text,level text,is_online boolean,last_seen timestamptz,status_message text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT p.id,p.display_name,p.username,p.avatar_url,p.bio,p.level,p.is_online,p.last_seen,p.status_message
 FROM public.public_profiles p WHERE p.id=ANY(p_ids);
$$;
NOTIFY pgrst,'reload schema';
