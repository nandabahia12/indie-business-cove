CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _j jsonb := to_jsonb(coalesce(NEW, OLD)); _org uuid;
BEGIN
  _org := CASE WHEN TG_TABLE_NAME = 'organizations' THEN (_j->>'id')::uuid ELSE (_j->>'organization_id')::uuid END;
  -- Ao excluir a organização inteira, não registra (o histórico é removido junto)
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org) THEN RETURN OLD; END IF;
  PERFORM public.write_audit(_org, TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, NULL,
    CASE WHEN TG_TABLE_NAME = 'organization_settings' THEN jsonb_build_object('key', _j->>'key')
         WHEN TG_TABLE_NAME = 'organization_modules' THEN jsonb_build_object('module', _j->>'module_key', 'enabled', _j->'enabled')
         ELSE '{}'::jsonb END);
  RETURN coalesce(NEW, OLD);
END $$;