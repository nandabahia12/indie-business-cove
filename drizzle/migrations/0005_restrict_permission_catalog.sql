DROP POLICY "catalog read" ON public.permissions;
DROP POLICY "catalog read" ON public.role_permissions;
CREATE POLICY "catalog read members" ON public.permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'));
CREATE POLICY "catalog read members" ON public.role_permissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = auth.uid() AND m.status = 'active'));