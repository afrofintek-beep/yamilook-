
-- Secure user-owned encrypted snapshots, no public listing or server-readable plaintext.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('account-backups', 'account-backups', false, 20971520, ARRAY['application/json']::text[])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "account_backups_select_own" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id='account-backups' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

CREATE POLICY "account_backups_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id='account-backups'
  AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
  AND storage.extension(name)='json'
);

CREATE POLICY "account_backups_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id='account-backups' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text);

-- Include only files with verified Storage owner_id: old objects missing attribution
-- cannot safely be assigned to an account. No fictitious quotas or total.
CREATE OR REPLACE FUNCTION public.my_attributed_storage_usage()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'bytes', COALESCE(SUM((o.metadata->>'size')::bigint),0),
    'photos', COALESCE(SUM((o.metadata->>'size')::bigint) FILTER(WHERE COALESCE(o.metadata->>'mimetype','') LIKE 'image/%'),0),
    'videos', COALESCE(SUM((o.metadata->>'size')::bigint) FILTER(WHERE COALESCE(o.metadata->>'mimetype','') LIKE 'video/%'),0),
    'other', COALESCE(SUM((o.metadata->>'size')::bigint) FILTER(WHERE COALESCE(o.metadata->>'mimetype','') NOT LIKE 'image/%' AND COALESCE(o.metadata->>'mimetype','') NOT LIKE 'video/%'),0),
    'files', COUNT(*),
    'attribution', 'verified-owner-only'
  )
  FROM storage.objects o
  WHERE o.owner_id=(SELECT auth.uid())::text AND o.bucket_id <> 'account-backups'
    AND (o.metadata->>'size') ~ '^[0-9]+$'
    AND (SELECT auth.uid()) IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.my_attributed_storage_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_attributed_storage_usage() TO authenticated;
