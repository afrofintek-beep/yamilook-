ALTER POLICY "Authenticated users can view all profiles" ON public.profiles
 USING ((select auth.uid())=id OR public.has_role((select auth.uid()),'admin'));
ALTER POLICY "Authenticated users can view all profiles" ON public.profiles
 RENAME TO "Owners and administrators read full profiles";
ALTER POLICY "Users can update own profile" ON public.profiles
 USING ((select auth.uid())=id) WITH CHECK ((select auth.uid())=id);

CREATE OR REPLACE FUNCTION public.generate_afroloc_code(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cc text; v_lat double precision; v_lng double precision;
  v_city text; v_nb text; v_prov text; v_mun text; v_com text;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role'
     and (auth.uid() is null or (auth.uid() <> p_user_id and not public.has_role(auth.uid(),'admin'))) then
    raise exception 'Private location access denied' using errcode='42501';
  end if;
  select upper(country_code), latitude, longitude, city, neighborhood
    into v_cc, v_lat, v_lng, v_city, v_nb
    from public.profiles where id = p_user_id;
  if v_lat is null or v_lng is null then return null; end if;
  if v_cc = 'AO' and v_city is not null and v_nb is not null then
    select prov_seg, mun_slug, com_slug into v_prov, v_mun, v_com
      from public.afroloc_banda_division
     where country_code='AO' and lower(city)=lower(v_city) and banda_norm=lower(btrim(v_nb)) limit 1;
  end if;
  return public.afroloc_nom(coalesce(v_cc,'AO'), v_prov, v_mun, v_com, v_lat, v_lng);
end;
$function$;
REVOKE ALL ON FUNCTION public.generate_afroloc_code(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.generate_afroloc_code(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_public_profile(p_username text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select json_build_object(
    'id', p.id,
    'display_name', p.display_name,
    'username', p.username,
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
  where lower(p.username) = lower(p_username)
  limit 1;
$function$;

-- Owners can edit their profile and preferences, not balances or system-verification flags.
REVOKE UPDATE ON public.profiles FROM PUBLIC,anon,authenticated;
GRANT UPDATE(display_name,username,avatar_url,bio,birthday,gender,status_message,
 phone_number,show_last_seen,show_online_status,show_read_receipts,show_typing_indicators,
 profile_theme_color,two_factor_enabled,contacts_synced,onboarding_completed,app_tour_completed,
 photos_visibility,country_code,city,neighborhood,latitude,longitude,partner_user_id)
ON public.profiles TO authenticated;
NOTIFY pgrst,'reload schema';
