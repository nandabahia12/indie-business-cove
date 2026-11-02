-- ===== Permissões por módulo e operação =====
INSERT INTO public.permissions(key, module_key, description)
SELECT m.key || '.' || o.op, m.key, o.op FROM public.modules m CROSS JOIN (VALUES ('create'),('update'),('delete')) o(op)
ON CONFLICT (key) DO NOTHING;
UPDATE public.permissions SET description = 'DEPRECATED: use create/update/delete' WHERE key LIKE '%.write';
DELETE FROM public.role_permissions WHERE role IN ('owner','admin','member','viewer');

INSERT INTO public.role_permissions(role, permission_key)
SELECT 'owner'::public.org_role, key FROM public.permissions WHERE key NOT LIKE '%.write'
UNION ALL SELECT 'admin', key FROM public.permissions WHERE key NOT LIKE '%.write' AND key <> 'core.manage'
UNION ALL SELECT 'manager', key FROM public.permissions WHERE split_part(key,'.',2) IN ('read','create','update','delete') AND module_key <> 'core'
UNION ALL SELECT 'manager', 'core.read'
UNION ALL SELECT 'collaborator', key FROM public.permissions WHERE split_part(key,'.',2) IN ('read','create','update') AND module_key IN ('crm','comercial','agenda','producao','documentos','ia')
UNION ALL SELECT 'collaborator', 'core.read'
UNION ALL SELECT 'freelancer', k FROM (VALUES ('core.read'),('agenda.read'),('producao.read'),('producao.update'),('documentos.read')) v(k);
-- client: nenhuma permissão de módulo; acessa apenas registros vinculados a ele.

-- Permissão exige papel ativo + módulo habilitado na organização
CREATE OR REPLACE FUNCTION public.has_org_permission(_org uuid, _permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_member_roles r
    JOIN public.organization_members m ON m.organization_id = r.organization_id AND m.user_id = r.user_id
    JOIN public.role_permissions rp ON rp.role = r.role
    JOIN public.permissions p ON p.key = rp.permission_key
    WHERE r.organization_id = _org AND r.user_id = auth.uid() AND m.status = 'active'
      AND rp.permission_key = _permission
      AND (p.module_key = 'core' OR EXISTS (SELECT 1 FROM public.organization_modules om
           WHERE om.organization_id = _org AND om.module_key = p.module_key AND om.enabled)))
$$;

-- Perfis: só a própria pessoa ou equipe com core.read em organização comum (cliente não vê outros)
CREATE OR REPLACE FUNCTION public.shares_org_with(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members b
    WHERE b.user_id = _user AND public.has_org_permission(b.organization_id, 'core.read'))
$$;

CREATE OR REPLACE FUNCTION public.my_org_permissions(_org uuid) RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.key FROM public.permissions p WHERE p.key NOT LIKE '%.write' AND public.has_org_permission(_org, p.key)
$$;
REVOKE EXECUTE ON FUNCTION public.my_org_permissions(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_org_permissions(uuid) TO authenticated;

-- ===== Auditoria =====
CREATE OR REPLACE FUNCTION public.write_audit(_org uuid, _action text, _type text, _id uuid, _meta jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_logs(organization_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (_org, auth.uid(), _action, _type, _id, coalesce(_meta,'{}'::jsonb))
$$;
REVOKE EXECUTE ON FUNCTION public.write_audit(uuid, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_row_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _r record := coalesce(NEW, OLD);
BEGIN
  PERFORM public.write_audit(
    CASE WHEN TG_TABLE_NAME = 'organizations' THEN _r.id ELSE _r.organization_id END,
    TG_TABLE_NAME || '.' || lower(TG_OP), TG_TABLE_NAME, NULL,
    CASE WHEN TG_TABLE_NAME = 'organization_settings' THEN jsonb_build_object('key', _r.key)
         WHEN TG_TABLE_NAME = 'organization_modules' THEN jsonb_build_object('module', _r.module_key, 'enabled', _r.enabled)
         ELSE '{}'::jsonb END);
  RETURN _r;
END $$;
CREATE TRIGGER trg_audit_org_update AFTER UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_modules AFTER INSERT OR UPDATE OR DELETE ON public.organization_modules FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER trg_audit_settings AFTER INSERT OR UPDATE OR DELETE ON public.organization_settings FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ===== Membros e papéis: leitura restrita, escrita apenas por funções =====
DROP POLICY "members read" ON public.organization_members;
DROP POLICY "members manage" ON public.organization_members;
DROP POLICY "roles read" ON public.organization_member_roles;
DROP POLICY "roles manage by owner" ON public.organization_member_roles;
CREATE POLICY "members read" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_org_permission(organization_id, 'core.read'));
CREATE POLICY "roles read" ON public.organization_member_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_org_permission(organization_id, 'core.read'));
REVOKE INSERT, UPDATE, DELETE ON public.organization_members, public.organization_member_roles FROM authenticated;

DROP POLICY "settings read" ON public.organization_settings;
CREATE POLICY "settings read" ON public.organization_settings FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'core.read'));

-- ===== Convites =====
CREATE TABLE public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.org_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invitations_org ON public.organization_invitations(organization_id);
CREATE UNIQUE INDEX uq_invitations_pending ON public.organization_invitations(organization_id, lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL;
GRANT SELECT ON public.organization_invitations TO authenticated;
GRANT ALL ON public.organization_invitations TO service_role;
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations read admins" ON public.organization_invitations FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

CREATE OR REPLACE FUNCTION public.create_invitation(_org uuid, _email text, _role public.org_role) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _token text; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF _role IN ('member','viewer') THEN RAISE EXCEPTION 'invalid_role' USING ERRCODE = '23514'; END IF;
  IF NOT public.has_org_role(_org, ARRAY['owner','admin']::public.org_role[]) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _role IN ('owner','admin') AND NOT public.has_org_role(_org, ARRAY['owner']::public.org_role[]) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  _token := encode(gen_random_bytes(32), 'hex');
  INSERT INTO public.organization_invitations(organization_id, email, role, token_hash, invited_by)
  VALUES (_org, lower(trim(_email)), _role, encode(digest(_token, 'sha256'), 'hex'), auth.uid()) RETURNING id INTO _id;
  PERFORM public.write_audit(_org, 'invitation.created', 'invitation', _id, jsonb_build_object('role', _role));
  RETURN _token;
END $$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _inv public.organization_invitations; _uid uuid := auth.uid(); _email text; _confirmed timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  SELECT email, email_confirmed_at INTO _email, _confirmed FROM auth.users WHERE id = _uid;
  IF _confirmed IS NULL THEN RAISE EXCEPTION 'email_not_confirmed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _inv FROM public.organization_invitations
   WHERE token_hash = encode(digest(_token, 'sha256'), 'hex') AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
   FOR UPDATE;
  IF NOT FOUND OR lower(_inv.email) <> lower(_email) THEN RAISE EXCEPTION 'invalid_invitation' USING ERRCODE = 'PGRST116'; END IF;
  INSERT INTO public.profiles(id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organization_members(organization_id, user_id, status) VALUES (_inv.organization_id, _uid, 'active')
    ON CONFLICT (organization_id, user_id) DO UPDATE SET status = 'active';
  DELETE FROM public.organization_member_roles WHERE organization_id = _inv.organization_id AND user_id = _uid AND role <> 'owner';
  INSERT INTO public.organization_member_roles(organization_id, user_id, role) VALUES (_inv.organization_id, _uid, _inv.role) ON CONFLICT DO NOTHING;
  UPDATE public.organization_invitations SET accepted_at = now(), accepted_by = _uid WHERE id = _inv.id;
  PERFORM public.write_audit(_inv.organization_id, 'invitation.accepted', 'invitation', _inv.id, jsonb_build_object('role', _inv.role));
  RETURN _inv.organization_id;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_invitation(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  SELECT organization_id INTO _org FROM public.organization_invitations WHERE id = _id AND accepted_at IS NULL AND revoked_at IS NULL;
  IF _org IS NULL OR NOT public.has_org_role(_org, ARRAY['owner','admin']::public.org_role[]) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.organization_invitations SET revoked_at = now() WHERE id = _id;
  PERFORM public.write_audit(_org, 'invitation.revoked', 'invitation', _id);
END $$;

CREATE OR REPLACE FUNCTION public.set_member_role(_org uuid, _user uuid, _role public.org_role) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _is_owner boolean := public.has_org_role(_org, ARRAY['owner']::public.org_role[]);
        _target_privileged boolean;
BEGIN
  IF _role IN ('member','viewer') THEN RAISE EXCEPTION 'invalid_role' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE organization_id = _org AND user_id = _user) THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'PGRST116'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.organization_member_roles WHERE organization_id = _org AND user_id = _user AND role IN ('owner','admin')) INTO _target_privileged;
  IF NOT (_is_owner OR (public.has_org_role(_org, ARRAY['admin']::public.org_role[]) AND NOT _target_privileged AND _role NOT IN ('owner','admin'))) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF _role <> 'owner' AND EXISTS (SELECT 1 FROM public.organization_member_roles WHERE organization_id = _org AND user_id = _user AND role = 'owner')
     AND (SELECT count(*) FROM public.organization_member_roles WHERE organization_id = _org AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'last_owner' USING ERRCODE = '23514'; END IF;
  DELETE FROM public.organization_member_roles WHERE organization_id = _org AND user_id = _user;
  INSERT INTO public.organization_member_roles(organization_id, user_id, role) VALUES (_org, _user, _role);
  PERFORM public.write_audit(_org, 'member.role_changed', 'member', _user, jsonb_build_object('role', _role));
END $$;

CREATE OR REPLACE FUNCTION public.remove_member(_org uuid, _user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _target_owner boolean; _target_priv boolean;
BEGIN
  SELECT bool_or(role = 'owner'), bool_or(role IN ('owner','admin')) INTO _target_owner, _target_priv
    FROM public.organization_member_roles WHERE organization_id = _org AND user_id = _user;
  IF NOT (_user = auth.uid()
          OR public.has_org_role(_org, ARRAY['owner']::public.org_role[])
          OR (public.has_org_role(_org, ARRAY['admin']::public.org_role[]) AND NOT coalesce(_target_priv,false))) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF coalesce(_target_owner,false) AND (SELECT count(*) FROM public.organization_member_roles WHERE organization_id = _org AND role = 'owner') <= 1 THEN
    RAISE EXCEPTION 'last_owner' USING ERRCODE = '23514'; END IF;
  DELETE FROM public.organization_members WHERE organization_id = _org AND user_id = _user;
  PERFORM public.write_audit(_org, 'member.removed', 'member', _user);
END $$;

REVOKE EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.org_role), public.accept_invitation(text), public.revoke_invitation(uuid), public.set_member_role(uuid, uuid, public.org_role), public.remove_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_invitation(uuid, text, public.org_role), public.accept_invitation(text), public.revoke_invitation(uuid), public.set_member_role(uuid, uuid, public.org_role), public.remove_member(uuid, uuid) TO authenticated;

-- ===== Arquivos: permissão por módulo e vínculo com cliente final =====
ALTER TABLE public.files ADD COLUMN module_key text REFERENCES public.modules(key) ON DELETE RESTRICT;
ALTER TABLE public.files ADD COLUMN client_user_id uuid;
CREATE INDEX idx_files_client ON public.files(organization_id, client_user_id);
DROP POLICY "files read" ON public.files;
DROP POLICY "files insert" ON public.files;
DROP POLICY "files update" ON public.files;
DROP POLICY "files delete" ON public.files;
CREATE POLICY "files read" ON public.files FOR SELECT TO authenticated USING (
  public.has_org_permission(organization_id, coalesce(module_key,'core') || '.read')
  OR (client_user_id = auth.uid() AND public.is_org_member(organization_id)));
CREATE POLICY "files insert" ON public.files FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND public.has_org_permission(organization_id, coalesce(module_key,'core') || '.create')
  AND split_part(path, '/', 2) = coalesce(module_key,'core'));
CREATE POLICY "files update" ON public.files FOR UPDATE TO authenticated
  USING (public.has_org_permission(organization_id, coalesce(module_key,'core') || '.update'))
  WITH CHECK (public.has_org_permission(organization_id, coalesce(module_key,'core') || '.update') AND split_part(path, '/', 2) = coalesce(module_key,'core'));
CREATE POLICY "files delete" ON public.files FOR DELETE TO authenticated
  USING (public.has_org_permission(organization_id, coalesce(module_key,'core') || '.delete'));

-- Storage: caminho {org}/{modulo}/...; leitura delega às regras da tabela files
DROP POLICY "org files read" ON storage.objects;
DROP POLICY "org files insert" ON storage.objects;
DROP POLICY "org files update" ON storage.objects;
DROP POLICY "org files delete" ON storage.objects;
CREATE OR REPLACE FUNCTION public.storage_org_permission(_name text, _op text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _org uuid;
BEGIN
  BEGIN _org := split_part(_name, '/', 1)::uuid; EXCEPTION WHEN others THEN RETURN false; END;
  RETURN public.has_org_permission(_org, split_part(_name, '/', 2) || '.' || _op);
END $$;
REVOKE EXECUTE ON FUNCTION public.storage_org_permission(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.storage_org_permission(text, text) TO authenticated;
CREATE POLICY "org files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-files' AND EXISTS (SELECT 1 FROM public.files f WHERE f.bucket = 'org-files' AND f.path = storage.objects.name));
CREATE POLICY "org files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-files' AND public.storage_org_permission(name, 'create'));
CREATE POLICY "org files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-files' AND public.storage_org_permission(name, 'update'));
CREATE POLICY "org files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-files' AND public.storage_org_permission(name, 'delete'));