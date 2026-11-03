DROP POLICY "files read" ON public.files;
CREATE POLICY "files read" ON public.files FOR SELECT TO authenticated USING (
  (public.has_org_permission(organization_id, coalesce(module_key,'core') || '.read')
    AND (client_user_id IS NULL OR public.has_org_permission(organization_id, 'crm.read')))
  OR (client_user_id = auth.uid() AND public.is_org_member(organization_id)));