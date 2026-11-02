-- ===== Tipos =====
CREATE TYPE public.org_role AS ENUM ('owner','admin','member','viewer');
CREATE TYPE public.member_status AS ENUM ('invited','active','suspended');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','canceled','expired');

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ===== Perfis (1:1 com usuários de autenticação) =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  locale text NOT NULL DEFAULT 'pt-BR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Catálogo da plataforma =====
CREATE TABLE public.modules (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_core boolean NOT NULL DEFAULT false,
  is_available boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.module_dependencies (
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
  depends_on text NOT NULL REFERENCES public.modules(key) ON DELETE RESTRICT,
  PRIMARY KEY (module_key, depends_on),
  CHECK (module_key <> depends_on)
);
CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_permissions_module ON public.permissions(module_key);
CREATE TABLE public.role_permissions (
  role public.org_role NOT NULL,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'BRL',
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month','year')),
  max_members integer CHECK (max_members IS NULL OR max_members > 0),
  ai_monthly_quota integer CHECK (ai_monthly_quota IS NULL OR ai_monthly_quota >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.plan_modules (
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE CASCADE,
  PRIMARY KEY (plan_id, module_key)
);
CREATE INDEX idx_plan_modules_module ON public.plan_modules(module_key);

GRANT SELECT ON public.modules, public.module_dependencies, public.permissions, public.role_permissions, public.plans, public.plan_modules TO authenticated;
GRANT ALL ON public.modules, public.module_dependencies, public.permissions, public.role_permissions, public.plans, public.plan_modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog read" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog read" ON public.module_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalog read" ON public.plans FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "catalog read" ON public.plan_modules FOR SELECT TO authenticated USING (true);

-- ===== Organizações (tenants) =====
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  segment text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_org_updated BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.member_status NOT NULL DEFAULT 'active',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

CREATE TABLE public.organization_member_roles (
  organization_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role public.org_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id, role),
  FOREIGN KEY (organization_id, user_id) REFERENCES public.organization_members(organization_id, user_id) ON DELETE CASCADE
);
CREATE INDEX idx_member_roles_user ON public.organization_member_roles(user_id);

CREATE TABLE public.organization_modules (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES public.modules(key) ON DELETE RESTRICT,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_key)
);
CREATE TRIGGER trg_org_modules_updated BEFORE UPDATE ON public.organization_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.organization_settings (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, key)
);
CREATE TRIGGER trg_org_settings_updated BEFORE UPDATE ON public.organization_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);
CREATE INDEX idx_subscriptions_org ON public.subscriptions(organization_id);
CREATE UNIQUE INDEX uq_subscriptions_one_live ON public.subscriptions(organization_id) WHERE status IN ('trialing','active','past_due');
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  bucket text NOT NULL DEFAULT 'org-files',
  path text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, path),
  CHECK (split_part(path, '/', 1) = organization_id::text)
);
CREATE INDEX idx_files_org ON public.files(organization_id);

CREATE TABLE public.audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_org_created ON public.audit_logs(organization_id, created_at DESC);

-- ===== Funções de acesso (security definer, evitam recursão) =====
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
    WHERE organization_id = _org AND user_id = auth.uid() AND status = 'active')
$$;
CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _roles public.org_role[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_member_roles r
    JOIN public.organization_members m ON m.organization_id = r.organization_id AND m.user_id = r.user_id
    WHERE r.organization_id = _org AND r.user_id = auth.uid() AND m.status = 'active' AND r.role = ANY(_roles))
$$;
CREATE OR REPLACE FUNCTION public.has_org_permission(_org uuid, _permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_member_roles r
    JOIN public.organization_members m ON m.organization_id = r.organization_id AND m.user_id = r.user_id
    JOIN public.role_permissions rp ON rp.role = r.role
    WHERE r.organization_id = _org AND r.user_id = auth.uid() AND m.status = 'active' AND rp.permission_key = _permission)
$$;
CREATE OR REPLACE FUNCTION public.shares_org_with(_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members a JOIN public.organization_members b
    ON a.organization_id = b.organization_id
    WHERE a.user_id = auth.uid() AND a.status = 'active' AND b.user_id = _user)
$$;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid), public.has_org_role(uuid, public.org_role[]), public.has_org_permission(uuid, text), public.shares_org_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid), public.has_org_role(uuid, public.org_role[]), public.has_org_permission(uuid, text), public.shares_org_with(uuid) TO authenticated;

-- Criação de organização: cria org, membro owner e módulos núcleo de forma atômica
CREATE OR REPLACE FUNCTION public.create_organization(_name text, _slug text, _segment text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _org uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  INSERT INTO public.profiles(id) VALUES (_uid) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations(name, slug, segment, created_by) VALUES (_name, _slug, _segment, _uid) RETURNING id INTO _org;
  INSERT INTO public.organization_members(organization_id, user_id, status) VALUES (_org, _uid, 'active');
  INSERT INTO public.organization_member_roles(organization_id, user_id, role) VALUES (_org, _uid, 'owner');
  INSERT INTO public.organization_modules(organization_id, module_key, enabled)
    SELECT _org, key, true FROM public.modules WHERE is_core;
  INSERT INTO public.audit_logs(organization_id, actor_id, action, entity_type, entity_id)
    VALUES (_org, _uid, 'organization.created', 'organization', _org);
  RETURN _org;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_organization(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text) TO authenticated;

-- Perfil automático no cadastro
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Grants e RLS das tabelas de organização =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations, public.organization_members, public.organization_member_roles, public.organization_modules, public.organization_settings, public.files TO authenticated;
GRANT SELECT ON public.subscriptions, public.audit_logs TO authenticated;
GRANT ALL ON public.organizations, public.organization_members, public.organization_member_roles, public.organization_modules, public.organization_settings, public.subscriptions, public.files, public.audit_logs TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_member_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles read self or teammates" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.shares_org_with(id));
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "org read members" ON public.organizations FOR SELECT TO authenticated USING (public.is_org_member(id));
CREATE POLICY "org update admins" ON public.organizations FOR UPDATE TO authenticated USING (public.has_org_role(id, ARRAY['owner','admin']::public.org_role[])) WITH CHECK (public.has_org_role(id, ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "org delete owner" ON public.organizations FOR DELETE TO authenticated USING (public.has_org_role(id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "members read" ON public.organization_members FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "members manage" ON public.organization_members FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "roles read" ON public.organization_member_roles FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "roles manage by owner" ON public.organization_member_roles FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner']::public.org_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['owner']::public.org_role[]));

CREATE POLICY "modules read" ON public.organization_modules FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "modules manage" ON public.organization_modules FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "settings read" ON public.organization_settings FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "settings manage" ON public.organization_settings FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "subscriptions read admins" ON public.subscriptions FOR SELECT TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

CREATE POLICY "files read" ON public.files FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY "files insert" ON public.files FOR INSERT TO authenticated WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','member']::public.org_role[]) AND uploaded_by = auth.uid());
CREATE POLICY "files update" ON public.files FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin','member']::public.org_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin','member']::public.org_role[]));
CREATE POLICY "files delete" ON public.files FOR DELETE TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]) OR uploaded_by = auth.uid());

CREATE POLICY "audit read admins" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]));

-- ===== Storage: arquivos privados por organização (pasta = organization_id) =====
CREATE POLICY "org files read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'org-files' AND public.is_org_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "org files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'org-files' AND public.has_org_role(((storage.foldername(name))[1])::uuid, ARRAY['owner','admin','member']::public.org_role[]));
CREATE POLICY "org files update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'org-files' AND public.has_org_role(((storage.foldername(name))[1])::uuid, ARRAY['owner','admin','member']::public.org_role[]));
CREATE POLICY "org files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'org-files' AND public.has_org_role(((storage.foldername(name))[1])::uuid, ARRAY['owner','admin']::public.org_role[]));

-- ===== Catálogo de sistema (definição do produto, não dados de cliente) =====
INSERT INTO public.modules(key, name, is_core, is_available, sort_order) VALUES
 ('core','Núcleo',true,true,0),('crm','CRM',true,true,10),('comercial','Comercial',false,true,20),
 ('agenda','Agenda',false,true,30),('producao','Produção',false,true,40),('financeiro','Financeiro',false,true,50),
 ('documentos','Documentos',false,true,60),('ia','Inteligência Artificial',false,true,70),('sites','Construtor de sites',false,false,90);
INSERT INTO public.module_dependencies(module_key, depends_on) VALUES
 ('crm','core'),('comercial','crm'),('agenda','crm'),('producao','comercial'),('producao','agenda'),
 ('financeiro','comercial'),('documentos','comercial'),('ia','core'),('sites','crm'),('sites','comercial');
INSERT INTO public.permissions(key, module_key, description)
 SELECT m.key || '.' || a.act, m.key, a.act FROM public.modules m CROSS JOIN (VALUES ('read'),('write'),('manage')) a(act);
INSERT INTO public.role_permissions(role, permission_key)
 SELECT 'owner'::public.org_role, key FROM public.permissions
 UNION ALL SELECT 'admin', key FROM public.permissions
 UNION ALL SELECT 'member', key FROM public.permissions WHERE key LIKE '%.read' OR key LIKE '%.write'
 UNION ALL SELECT 'viewer', key FROM public.permissions WHERE key LIKE '%.read';
