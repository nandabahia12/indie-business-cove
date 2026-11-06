CREATE TABLE public.user_dashboard_layouts (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_dashboard_layouts TO authenticated;
GRANT ALL ON public.user_dashboard_layouts TO service_role;
ALTER TABLE public.user_dashboard_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own layout" ON public.user_dashboard_layouts FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.is_org_member(organization_id))
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organization_id));
CREATE TRIGGER user_dashboard_layouts_updated BEFORE UPDATE ON public.user_dashboard_layouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();