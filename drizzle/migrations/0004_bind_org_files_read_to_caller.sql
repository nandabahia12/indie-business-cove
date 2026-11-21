DROP POLICY IF EXISTS "org files read" ON storage.objects;
CREATE POLICY "org files read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'org-files' AND EXISTS (
    SELECT 1 FROM public.files f
    WHERE f.bucket = 'org-files' AND f.path = storage.objects.name
      AND f.organization_id::text = split_part(storage.objects.name, '/', 1)
      AND (
        (public.has_org_permission(f.organization_id, coalesce(f.module_key, 'core') || '.read')
          AND (f.client_user_id IS NULL OR public.has_org_permission(f.organization_id, 'crm.read')))
        OR (f.client_user_id = (select auth.uid()) AND public.is_org_member(f.organization_id))
      )
  )
);