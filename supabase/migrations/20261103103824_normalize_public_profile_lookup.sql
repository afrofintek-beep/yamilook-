-- Public profile links trim usernames; legacy profile rows may contain edge spaces.
-- Keep the existing public field projection and execution grants unchanged.
-- Enforce uniqueness using the same comparison as public profile lookup.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_normalized_key
  ON public.profiles ((lower(btrim(username)))) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_public_profile(p_username text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', btrim(p.username),
    'avatar_url', p.avatar_url,
    'bio', p.bio,
    'status_message', p.status_message,
    'afroloc_code', null::text,
    'afroloc_certified', (p.afroloc_certification_status = 'certified'),
    'is_creator', coalesce(p.is_creator, false),
    'founder_number', p.founder_number,
    'created_at', p.created_at
  )
  from public.profiles p
  where lower(btrim(p.username)) = lower(btrim(p_username))
  limit 1;
$function$;
NOTIFY pgrst,'reload schema';
