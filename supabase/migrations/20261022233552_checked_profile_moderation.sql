-- Moderators act through a narrow checked endpoint, never a general profile write.
CREATE FUNCTION public.update_profile_moderation(p_target uuid,p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v public.profiles%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) THEN
   RAISE EXCEPTION 'Not authorized' USING ERRCODE='42501';
 END IF;
 IF NOT public.has_role(auth.uid(),'admin') AND public.has_role(p_target,'admin') THEN
   RAISE EXCEPTION 'Administrator account protected' USING ERRCODE='42501';
 END IF;
 IF p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR EXISTS (
   SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('account_status','suspended_until','suspension_reason')
 ) THEN RAISE EXCEPTION 'Invalid moderation fields'; END IF;
 v:=jsonb_populate_record(NULL::public.profiles,p_patch);
 UPDATE public.profiles p SET
 account_status=coalesce(v.account_status,p.account_status),
 suspended_until=CASE WHEN p_patch?'suspended_until' THEN v.suspended_until ELSE p.suspended_until END,
 suspension_reason=CASE WHEN p_patch?'suspension_reason' THEN v.suspension_reason ELSE p.suspension_reason END
 WHERE p.id=p_target;
END $$;
REVOKE ALL ON FUNCTION public.update_profile_moderation(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_profile_moderation(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
