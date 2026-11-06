-- ===== Normalização =====
CREATE OR REPLACE FUNCTION public.crm_email_norm(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(lower(btrim(coalesce(_t,''))), '')
$$;
CREATE OR REPLACE FUNCTION public.crm_phone_norm(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT nullif(CASE WHEN d ~ '^55[0-9]{10,11}$' THEN substr(d,3) ELSE ltrim(d,'0') END, '')
  FROM (SELECT regexp_replace(coalesce(_t,''), '[^0-9]', '', 'g') AS d) x
$$;
CREATE OR REPLACE FUNCTION public.crm_valid_doc(_d text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d text := regexp_replace(coalesce(_d,''), '[^0-9]', '', 'g'); s int; r int; i int; w int[];
BEGIN
  IF length(d) NOT IN (11,14) OR d = repeat(substr(d,1,1), length(d)) THEN RETURN false; END IF;
  IF length(d) = 11 THEN
    s := 0; FOR i IN 1..9 LOOP s := s + substr(d,i,1)::int * (11-i); END LOOP;
    r := (s*10) % 11; IF r = 10 THEN r := 0; END IF;
    IF r <> substr(d,10,1)::int THEN RETURN false; END IF;
    s := 0; FOR i IN 1..10 LOOP s := s + substr(d,i,1)::int * (12-i); END LOOP;
    r := (s*10) % 11; IF r = 10 THEN r := 0; END IF;
    RETURN r = substr(d,11,1)::int;
  END IF;
  w := ARRAY[5,4,3,2,9,8,7,6,5,4,3,2]; s := 0;
  FOR i IN 1..12 LOOP s := s + substr(d,i,1)::int * w[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  IF r <> substr(d,13,1)::int THEN RETURN false; END IF;
  w := ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2]; s := 0;
  FOR i IN 1..13 LOOP s := s + substr(d,i,1)::int * w[i]; END LOOP;
  r := s % 11; r := CASE WHEN r < 2 THEN 0 ELSE 11 - r END;
  RETURN r = substr(d,14,1)::int;
END $$;

-- ===== Tabelas =====
CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'pf' CHECK (kind IN ('pf','pj')),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  trade_name text,
  email text, email_norm text,
  phone text, phone_digits text,
  whatsapp text, whatsapp_digits text,
  address_street text, address_number text, address_complement text, address_district text,
  address_city text, address_state text, address_zip text,
  source text, category text,
  relationship text NOT NULL DEFAULT 'lead' CHECK (relationship IN ('lead','client','partner','other')),
  notes text, preferences text,
  pj_contact_name text, pj_contact_role text, pj_contact_email text, pj_contact_phone text,
  owner_id uuid, created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  merged_into_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL
);
CREATE INDEX crm_contacts_org_created ON public.crm_contacts(organization_id, created_at DESC);
CREATE INDEX crm_contacts_org_name ON public.crm_contacts(organization_id, lower(name));
CREATE INDEX crm_contacts_org_email ON public.crm_contacts(organization_id, email_norm);
CREATE INDEX crm_contacts_org_phone ON public.crm_contacts(organization_id, phone_digits);
CREATE INDEX crm_contacts_org_whats ON public.crm_contacts(organization_id, whatsapp_digits);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_contacts_select ON public.crm_contacts FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_contacts_insert ON public.crm_contacts FOR INSERT TO authenticated WITH CHECK (public.has_org_permission(organization_id, 'crm.create'));
CREATE POLICY crm_contacts_update ON public.crm_contacts FOR UPDATE TO authenticated USING (public.has_org_permission(organization_id, 'crm.update')) WITH CHECK (public.has_org_permission(organization_id, 'crm.update'));
CREATE POLICY crm_contacts_delete ON public.crm_contacts FOR DELETE TO authenticated USING (public.has_org_permission(organization_id, 'crm.manage'));

-- Documento (CPF/CNPJ) separado: só quem edita contatos lê.
CREATE TABLE public.crm_contact_private (
  contact_id uuid PRIMARY KEY REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  doc text, doc_digits text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_private_org_doc ON public.crm_contact_private(organization_id, doc_digits);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contact_private TO authenticated;
GRANT ALL ON public.crm_contact_private TO service_role;
ALTER TABLE public.crm_contact_private ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_private_all ON public.crm_contact_private FOR ALL TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.update'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.update') OR public.has_org_permission(organization_id, 'crm.create'));

CREATE TABLE public.crm_contact_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('email','phone','whatsapp')),
  value text NOT NULL CHECK (length(btrim(value)) BETWEEN 1 AND 200),
  norm text,
  label text NOT NULL DEFAULT 'other' CHECK (label IN ('personal','work','whatsapp','other')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_channels_org_norm ON public.crm_contact_channels(organization_id, norm);
CREATE INDEX crm_channels_contact ON public.crm_contact_channels(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contact_channels TO authenticated;
GRANT ALL ON public.crm_contact_channels TO service_role;
ALTER TABLE public.crm_contact_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_channels_select ON public.crm_contact_channels FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_channels_write ON public.crm_contact_channels FOR ALL TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.update'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.update') OR public.has_org_permission(organization_id, 'crm.create'));

CREATE TABLE public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_tags_org_name ON public.crm_tags(organization_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tags TO authenticated;
GRANT ALL ON public.crm_tags TO service_role;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_tags_select ON public.crm_tags FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_tags_write ON public.crm_tags FOR ALL TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.update'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.update') OR public.has_org_permission(organization_id, 'crm.create'));

CREATE TABLE public.crm_contact_tags (
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX crm_contact_tags_tag ON public.crm_contact_tags(tag_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contact_tags TO authenticated;
GRANT ALL ON public.crm_contact_tags TO service_role;
ALTER TABLE public.crm_contact_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_ctags_select ON public.crm_contact_tags FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_ctags_write ON public.crm_contact_tags FOR ALL TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.update'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.update') OR public.has_org_permission(organization_id, 'crm.create'));

CREATE TABLE public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 60),
  position integer NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'open' CHECK (kind IN ('open','won','lost')),
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_stages_org ON public.crm_pipeline_stages(organization_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipeline_stages TO authenticated;
GRANT ALL ON public.crm_pipeline_stages TO service_role;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_stages_select ON public.crm_pipeline_stages FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_stages_write ON public.crm_pipeline_stages FOR ALL TO authenticated
  USING (public.has_org_permission(organization_id, 'crm.manage'))
  WITH CHECK (public.has_org_permission(organization_id, 'crm.manage'));

CREATE TABLE public.crm_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE RESTRICT,
  stage_id uuid NOT NULL REFERENCES public.crm_pipeline_stages(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text, notes text,
  value_cents bigint CHECK (value_cents IS NULL OR value_cents >= 0),
  owner_id uuid,
  expected_close_date date,
  lost_reason text,
  won_at timestamptz, won_by uuid, lost_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_deals_org_stage ON public.crm_deals(organization_id, stage_id);
CREATE INDEX crm_deals_contact ON public.crm_deals(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_deals TO authenticated;
GRANT ALL ON public.crm_deals TO service_role;
ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_deals_select ON public.crm_deals FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_deals_insert ON public.crm_deals FOR INSERT TO authenticated WITH CHECK (public.has_org_permission(organization_id, 'crm.create'));
CREATE POLICY crm_deals_update ON public.crm_deals FOR UPDATE TO authenticated USING (public.has_org_permission(organization_id, 'crm.update')) WITH CHECK (public.has_org_permission(organization_id, 'crm.update'));
CREATE POLICY crm_deals_delete ON public.crm_deals FOR DELETE TO authenticated USING (public.has_org_permission(organization_id, 'crm.delete'));

CREATE TABLE public.crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('call','whatsapp','email','meeting','note','system')),
  event text,
  body text CHECK (body IS NULL OR length(body) <= 5000),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  author_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_interactions_contact ON public.crm_interactions(contact_id, occurred_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interactions TO authenticated;
GRANT ALL ON public.crm_interactions TO service_role;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_inter_select ON public.crm_interactions FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_inter_insert ON public.crm_interactions FOR INSERT TO authenticated
  WITH CHECK (kind <> 'system' AND author_id = auth.uid() AND (public.has_org_permission(organization_id, 'crm.create') OR public.has_org_permission(organization_id, 'crm.update')));
CREATE POLICY crm_inter_delete ON public.crm_interactions FOR DELETE TO authenticated USING (kind <> 'system' AND public.has_org_permission(organization_id, 'crm.delete'));

CREATE TABLE public.crm_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  deal_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text,
  due_date date NOT NULL,
  due_time time,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','canceled')),
  assignee_id uuid,
  is_auto boolean NOT NULL DEFAULT false,
  done_at timestamptz, done_by uuid, canceled_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_reminders_org_due ON public.crm_reminders(organization_id, status, due_date);
CREATE INDEX crm_reminders_contact ON public.crm_reminders(contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_reminders TO authenticated;
GRANT ALL ON public.crm_reminders TO service_role;
ALTER TABLE public.crm_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_rem_select ON public.crm_reminders FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_rem_insert ON public.crm_reminders FOR INSERT TO authenticated WITH CHECK (public.has_org_permission(organization_id, 'crm.create') OR public.has_org_permission(organization_id, 'crm.update'));
CREATE POLICY crm_rem_update ON public.crm_reminders FOR UPDATE TO authenticated USING (public.has_org_permission(organization_id, 'crm.update')) WITH CHECK (public.has_org_permission(organization_id, 'crm.update'));
CREATE POLICY crm_rem_delete ON public.crm_reminders FOR DELETE TO authenticated USING (public.has_org_permission(organization_id, 'crm.delete'));

CREATE TABLE public.crm_duplicate_dismissals (
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_a uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  contact_b uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_a, contact_b),
  CHECK (contact_a < contact_b)
);
GRANT SELECT, INSERT, DELETE ON public.crm_duplicate_dismissals TO authenticated;
GRANT ALL ON public.crm_duplicate_dismissals TO service_role;
ALTER TABLE public.crm_duplicate_dismissals ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_dismiss_select ON public.crm_duplicate_dismissals FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.read'));
CREATE POLICY crm_dismiss_write ON public.crm_duplicate_dismissals FOR INSERT TO authenticated WITH CHECK (public.has_org_permission(organization_id, 'crm.update'));
CREATE POLICY crm_dismiss_delete ON public.crm_duplicate_dismissals FOR DELETE TO authenticated USING (public.has_org_permission(organization_id, 'crm.update'));

CREATE TABLE public.crm_intake_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result text NOT NULL CHECK (result IN ('created','matched','rejected')),
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  errors text[] NOT NULL DEFAULT '{}',
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by uuid DEFAULT auth.uid()
);
CREATE INDEX crm_intake_org ON public.crm_intake_log(organization_id, received_at DESC);
GRANT SELECT ON public.crm_intake_log TO authenticated;
GRANT ALL ON public.crm_intake_log TO service_role;
ALTER TABLE public.crm_intake_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY crm_intake_select ON public.crm_intake_log FOR SELECT TO authenticated USING (public.has_org_permission(organization_id, 'crm.manage'));

ALTER TABLE public.files ADD COLUMN crm_contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL;
CREATE INDEX files_crm_contact ON public.files(crm_contact_id);

-- ===== Triggers de consistência =====
CREATE TRIGGER crm_contacts_updated BEFORE UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER crm_deals_updated BEFORE UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER crm_reminders_updated BEFORE UPDATE ON public.crm_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.crm_contact_normalize() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  NEW.email_norm := public.crm_email_norm(NEW.email);
  NEW.phone_digits := public.crm_phone_norm(NEW.phone);
  NEW.whatsapp_digits := public.crm_phone_norm(NEW.whatsapp);
  IF NEW.email_norm IS NOT NULL AND NEW.email_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_contacts_normalize BEFORE INSERT OR UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.crm_contact_normalize();

CREATE OR REPLACE FUNCTION public.crm_private_normalize() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.doc_digits := nullif(regexp_replace(coalesce(NEW.doc,''), '[^0-9]', '', 'g'), '');
  IF NEW.doc_digits IS NOT NULL AND NOT public.crm_valid_doc(NEW.doc_digits) THEN
    RAISE EXCEPTION 'CPF/CNPJ inválido' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crm_contacts c WHERE c.id = NEW.contact_id AND c.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Contato de outra organização' USING ERRCODE = '42501';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER crm_private_normalize BEFORE INSERT OR UPDATE ON public.crm_contact_private FOR EACH ROW EXECUTE FUNCTION public.crm_private_normalize();

CREATE OR REPLACE FUNCTION public.crm_channel_normalize() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.norm := CASE WHEN NEW.type = 'email' THEN public.crm_email_norm(NEW.value) ELSE public.crm_phone_norm(NEW.value) END;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_channels_normalize BEFORE INSERT OR UPDATE ON public.crm_contact_channels FOR EACH ROW EXECUTE FUNCTION public.crm_channel_normalize();

-- Garante que contato/oportunidade/etapa/etiqueta referenciados pertencem à mesma organização.
CREATE OR REPLACE FUNCTION public.crm_check_same_org() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j jsonb := to_jsonb(NEW); o uuid := NEW.organization_id;
BEGIN
  IF j ? 'contact_id' AND j->>'contact_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_contacts WHERE id = (j->>'contact_id')::uuid AND organization_id = o) THEN
    RAISE EXCEPTION 'Contato inválido' USING ERRCODE = '42501'; END IF;
  IF j ? 'deal_id' AND j->>'deal_id' IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_deals WHERE id = (j->>'deal_id')::uuid AND organization_id = o) THEN
    RAISE EXCEPTION 'Oportunidade inválida' USING ERRCODE = '42501'; END IF;
  IF j ? 'tag_id' AND NOT EXISTS (SELECT 1 FROM crm_tags WHERE id = (j->>'tag_id')::uuid AND organization_id = o) THEN
    RAISE EXCEPTION 'Etiqueta inválida' USING ERRCODE = '42501'; END IF;
  IF j ? 'contact_a' AND NOT EXISTS (SELECT 1 FROM crm_contacts WHERE id IN ((j->>'contact_a')::uuid, (j->>'contact_b')::uuid) AND organization_id = o HAVING count(*) = 2) THEN
    RAISE EXCEPTION 'Contato inválido' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_channels_org BEFORE INSERT OR UPDATE ON public.crm_contact_channels FOR EACH ROW EXECUTE FUNCTION public.crm_check_same_org();
CREATE TRIGGER crm_ctags_org BEFORE INSERT OR UPDATE ON public.crm_contact_tags FOR EACH ROW EXECUTE FUNCTION public.crm_check_same_org();
CREATE TRIGGER crm_inter_org BEFORE INSERT OR UPDATE ON public.crm_interactions FOR EACH ROW EXECUTE FUNCTION public.crm_check_same_org();
CREATE TRIGGER crm_rem_org BEFORE INSERT OR UPDATE ON public.crm_reminders FOR EACH ROW EXECUTE FUNCTION public.crm_check_same_org();
CREATE TRIGGER crm_dismiss_org BEFORE INSERT ON public.crm_duplicate_dismissals FOR EACH ROW EXECUTE FUNCTION public.crm_check_same_org();

CREATE OR REPLACE FUNCTION public.crm_files_check() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.crm_contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM crm_contacts WHERE id = NEW.crm_contact_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Contato inválido' USING ERRCODE = '42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER files_crm_check BEFORE INSERT OR UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.crm_files_check();

-- ===== Histórico automático =====
CREATE OR REPLACE FUNCTION public.crm_log(_org uuid, _contact uuid, _deal uuid, _event text, _body text, _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO crm_interactions(organization_id, contact_id, deal_id, kind, event, body, metadata, author_id)
  VALUES (_org, _contact, _deal, 'system', _event, _body, coalesce(_meta,'{}'::jsonb), auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.crm_log(uuid,uuid,uuid,text,text,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_contact_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE changed text[] := '{}';
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, 'contact_created', 'Contato cadastrado', '{}'); RETURN NEW;
  END IF;
  IF NEW.merged_into_id IS DISTINCT FROM OLD.merged_into_id THEN RETURN NEW; END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, 'owner_changed', 'Responsável alterado', jsonb_build_object('from', OLD.owner_id, 'to', NEW.owner_id));
  END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, CASE WHEN NEW.archived_at IS NULL THEN 'contact_restored' ELSE 'contact_archived' END,
      CASE WHEN NEW.archived_at IS NULL THEN 'Contato reativado' ELSE 'Contato arquivado' END, '{}');
  END IF;
  IF NEW.name IS DISTINCT FROM OLD.name THEN changed := changed || 'nome'; END IF;
  IF NEW.email_norm IS DISTINCT FROM OLD.email_norm THEN changed := changed || 'e-mail'; END IF;
  IF NEW.phone_digits IS DISTINCT FROM OLD.phone_digits THEN changed := changed || 'telefone'; END IF;
  IF NEW.whatsapp_digits IS DISTINCT FROM OLD.whatsapp_digits THEN changed := changed || 'WhatsApp'; END IF;
  IF NEW.kind IS DISTINCT FROM OLD.kind THEN changed := changed || 'tipo'; END IF;
  IF NEW.relationship IS DISTINCT FROM OLD.relationship THEN changed := changed || 'relacionamento'; END IF;
  IF NEW.address_city IS DISTINCT FROM OLD.address_city OR NEW.address_street IS DISTINCT FROM OLD.address_street THEN changed := changed || 'endereço'; END IF;
  IF array_length(changed, 1) > 0 THEN
    PERFORM crm_log(NEW.organization_id, NEW.id, NULL, 'contact_updated', 'Cadastro alterado: ' || array_to_string(changed, ', '), jsonb_build_object('fields', changed));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_contacts_history AFTER INSERT OR UPDATE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.crm_contact_history();

CREATE OR REPLACE FUNCTION public.crm_deal_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; old_kind text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM crm_contacts WHERE id = NEW.contact_id AND organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION 'Contato inválido' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM crm_pipeline_stages WHERE id = NEW.stage_id AND organization_id = NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Etapa inválida' USING ERRCODE = '42501'; END IF;
  IF TG_OP = 'UPDATE' AND NEW.organization_id <> OLD.organization_id THEN RAISE EXCEPTION 'Organização não pode mudar' USING ERRCODE = '42501'; END IF;
  IF s.archived_at IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.stage_id <> OLD.stage_id) THEN
    RAISE EXCEPTION 'Etapa arquivada' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' THEN SELECT kind INTO old_kind FROM crm_pipeline_stages WHERE id = OLD.stage_id; END IF;
  IF TG_OP = 'INSERT' OR NEW.stage_id <> OLD.stage_id THEN
    IF s.kind = 'won' AND coalesce(old_kind,'') <> 'won' THEN NEW.won_at := now(); NEW.won_by := auth.uid(); NEW.lost_at := NULL;
    ELSIF s.kind = 'lost' AND coalesce(old_kind,'') <> 'lost' THEN NEW.lost_at := now(); NEW.won_at := NULL; NEW.won_by := NULL;
    ELSIF s.kind = 'open' THEN NEW.won_at := NULL; NEW.won_by := NULL; NEW.lost_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_deals_before BEFORE INSERT OR UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.crm_deal_before();

CREATE OR REPLACE FUNCTION public.crm_deal_after() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ns record; os record; days int; ev text; txt text;
BEGIN
  SELECT * INTO ns FROM crm_pipeline_stages WHERE id = NEW.stage_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM crm_log(NEW.organization_id, NEW.contact_id, NEW.id, 'deal_created', 'Oportunidade criada: ' || NEW.title, jsonb_build_object('stage', ns.name));
  ELSE
    IF NEW.stage_id <> OLD.stage_id THEN
      SELECT * INTO os FROM crm_pipeline_stages WHERE id = OLD.stage_id;
      ev := CASE WHEN ns.kind = 'won' THEN 'deal_won' WHEN ns.kind = 'lost' THEN 'deal_lost'
                 WHEN os.kind IN ('won','lost') THEN 'deal_reopened' ELSE 'stage_changed' END;
      txt := CASE ev WHEN 'deal_won' THEN 'Oportunidade contratada: ' WHEN 'deal_lost' THEN 'Oportunidade perdida: '
                     WHEN 'deal_reopened' THEN 'Oportunidade reaberta: ' ELSE 'Etapa alterada: ' END
             || NEW.title || ' (' || os.name || ' → ' || ns.name || ')';
      PERFORM crm_log(NEW.organization_id, NEW.contact_id, NEW.id, ev, txt,
        jsonb_build_object('from', os.name, 'to', ns.name, 'lost_reason', NEW.lost_reason));
    END IF;
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
      PERFORM crm_log(NEW.organization_id, NEW.contact_id, NEW.id, 'deal_owner_changed', 'Responsável da oportunidade alterado: ' || NEW.title,
        jsonb_build_object('from', OLD.owner_id, 'to', NEW.owner_id));
    END IF;
  END IF;
  IF ns.kind = 'won' AND (TG_OP = 'INSERT' OR NEW.stage_id <> OLD.stage_id) AND NEW.won_at IS NOT NULL THEN
    SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value::text)::int END INTO days
      FROM organization_settings WHERE organization_id = NEW.organization_id AND key = 'crm.reminder_default_days';
    days := least(greatest(coalesce(days, 2), 0), 365);
    INSERT INTO crm_reminders(organization_id, contact_id, deal_id, title, description, due_date, priority, assignee_id, is_auto, created_by)
    VALUES (NEW.organization_id, NEW.contact_id, NEW.id, 'Próximos passos: ' || NEW.title,
      'Lembrete criado automaticamente na contratação. Alinhe início do projeto, contrato e entregas.',
      (now() AT TIME ZONE 'America/Bahia')::date + days, 'high', coalesce(NEW.owner_id, auth.uid()), true, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_deals_after AFTER INSERT OR UPDATE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.crm_deal_after();

CREATE OR REPLACE FUNCTION public.crm_reminder_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM crm_log(NEW.organization_id, NEW.contact_id, NEW.deal_id, 'reminder_created', 'Lembrete criado: ' || NEW.title, jsonb_build_object('reminder_id', NEW.id));
  ELSIF NEW.status <> OLD.status THEN
    PERFORM crm_log(NEW.organization_id, NEW.contact_id, NEW.deal_id,
      CASE NEW.status WHEN 'done' THEN 'reminder_done' WHEN 'canceled' THEN 'reminder_canceled' ELSE 'reminder_reopened' END,
      CASE NEW.status WHEN 'done' THEN 'Lembrete concluído: ' WHEN 'canceled' THEN 'Lembrete cancelado: ' ELSE 'Lembrete reaberto: ' END || NEW.title,
      jsonb_build_object('reminder_id', NEW.id));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_reminders_history AFTER INSERT OR UPDATE ON public.crm_reminders FOR EACH ROW EXECUTE FUNCTION public.crm_reminder_history();

CREATE OR REPLACE FUNCTION public.crm_reminder_status() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.done_at := CASE WHEN NEW.status = 'done' THEN now() END;
    NEW.done_by := CASE WHEN NEW.status = 'done' THEN auth.uid() END;
    NEW.canceled_at := CASE WHEN NEW.status = 'canceled' THEN now() END;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_reminders_status BEFORE UPDATE ON public.crm_reminders FOR EACH ROW EXECUTE FUNCTION public.crm_reminder_status();

CREATE OR REPLACE FUNCTION public.crm_file_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.crm_contact_id IS NOT NULL THEN
    PERFORM crm_log(NEW.organization_id, NEW.crm_contact_id, NULL, 'document_added', 'Documento anexado: ' || NEW.name, jsonb_build_object('file_id', NEW.id));
  ELSIF TG_OP = 'DELETE' AND OLD.crm_contact_id IS NOT NULL AND EXISTS (SELECT 1 FROM crm_contacts WHERE id = OLD.crm_contact_id) THEN
    PERFORM crm_log(OLD.organization_id, OLD.crm_contact_id, NULL, 'document_removed', 'Documento removido: ' || OLD.name, '{}');
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER files_crm_history AFTER INSERT OR DELETE ON public.files FOR EACH ROW EXECUTE FUNCTION public.crm_file_history();

CREATE TRIGGER crm_contacts_audit_delete AFTER DELETE ON public.crm_contacts FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER crm_deals_audit_delete AFTER DELETE ON public.crm_deals FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ===== Etapas padrão =====
CREATE OR REPLACE FUNCTION public.crm_seed_stages(_org uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM crm_pipeline_stages WHERE organization_id = _org) THEN RETURN; END IF;
  INSERT INTO crm_pipeline_stages(organization_id, name, position, kind, is_default)
  SELECT _org, n, p, k, true FROM (VALUES
    ('Novo Lead',1,'open'),('Primeiro Contato',2,'open'),('Briefing / Reunião',3,'open'),
    ('Proposta Enviada',4,'open'),('Em Negociação',5,'open'),('Aguardando Contrato',6,'open'),
    ('Contratado',7,'won'),('Perdido',8,'lost'),('Futuro / Nutrição',9,'open')) v(n,p,k);
END $$;
REVOKE EXECUTE ON FUNCTION public.crm_seed_stages(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crm_on_module() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.module_key = 'crm' AND NEW.enabled THEN PERFORM crm_seed_stages(NEW.organization_id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_module_seed AFTER INSERT OR UPDATE ON public.organization_modules FOR EACH ROW EXECUTE FUNCTION public.crm_on_module();

SELECT public.crm_seed_stages(organization_id) FROM public.organization_modules WHERE module_key = 'crm' AND enabled;

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.crm_find_duplicates(_org uuid, _email text, _phone text, _whatsapp text, _doc text, _exclude uuid DEFAULT NULL)
RETURNS TABLE(id uuid, name text, kind text, email text, phone text, archived boolean, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE e text := crm_email_norm(_email); p text := crm_phone_norm(_phone); w text := crm_phone_norm(_whatsapp);
        d text := nullif(regexp_replace(coalesce(_doc,''), '[^0-9]', '', 'g'), ''); nums text[];
BEGIN
  IF NOT has_org_permission(_org, 'crm.read') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  nums := array_remove(ARRAY[p, w], NULL);
  RETURN QUERY
  SELECT c.id, c.name, c.kind, c.email, coalesce(c.phone, c.whatsapp), c.archived_at IS NOT NULL,
    (CASE WHEN d IS NOT NULL AND EXISTS (SELECT 1 FROM crm_contact_private x WHERE x.contact_id = c.id AND x.doc_digits = d) THEN 'documento'
          WHEN e IS NOT NULL AND (c.email_norm = e OR EXISTS (SELECT 1 FROM crm_contact_channels ch WHERE ch.contact_id = c.id AND ch.type = 'email' AND ch.norm = e)) THEN 'e-mail'
          ELSE 'telefone' END)
  FROM crm_contacts c
  WHERE c.organization_id = _org AND c.merged_into_id IS NULL AND (_exclude IS NULL OR c.id <> _exclude)
    AND ( (e IS NOT NULL AND (c.email_norm = e OR EXISTS (SELECT 1 FROM crm_contact_channels ch WHERE ch.contact_id = c.id AND ch.type = 'email' AND ch.norm = e)))
       OR (cardinality(nums) > 0 AND (c.phone_digits = ANY(nums) OR c.whatsapp_digits = ANY(nums)
            OR EXISTS (SELECT 1 FROM crm_contact_channels ch WHERE ch.contact_id = c.id AND ch.type <> 'email' AND ch.norm = ANY(nums))))
       OR (d IS NOT NULL AND EXISTS (SELECT 1 FROM crm_contact_private x WHERE x.contact_id = c.id AND x.doc_digits = d)) )
  LIMIT 10;
END $$;

CREATE OR REPLACE FUNCTION public.crm_duplicate_pairs(_org uuid)
RETURNS TABLE(a uuid, b uuid, reason text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_org_permission(_org, 'crm.update') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  RETURN QUERY
  WITH keys AS (
    SELECT c.id, 'e-mail'::text r, c.email_norm k FROM crm_contacts c WHERE c.organization_id = _org AND c.merged_into_id IS NULL AND c.email_norm IS NOT NULL
    UNION SELECT c.id, 'telefone', c.phone_digits FROM crm_contacts c WHERE c.organization_id = _org AND c.merged_into_id IS NULL AND c.phone_digits IS NOT NULL
    UNION SELECT c.id, 'telefone', c.whatsapp_digits FROM crm_contacts c WHERE c.organization_id = _org AND c.merged_into_id IS NULL AND c.whatsapp_digits IS NOT NULL
    UNION SELECT ch.contact_id, CASE WHEN ch.type = 'email' THEN 'e-mail' ELSE 'telefone' END, ch.norm FROM crm_contact_channels ch
      JOIN crm_contacts c ON c.id = ch.contact_id AND c.merged_into_id IS NULL WHERE ch.organization_id = _org AND ch.norm IS NOT NULL
    UNION SELECT x.contact_id, 'documento', x.doc_digits FROM crm_contact_private x
      JOIN crm_contacts c ON c.id = x.contact_id AND c.merged_into_id IS NULL WHERE x.organization_id = _org AND x.doc_digits IS NOT NULL
  )
  SELECT k1.id, k2.id, min(k1.r)
  FROM keys k1 JOIN keys k2 ON k1.k = k2.k AND k1.r = k2.r AND k1.id < k2.id
  WHERE NOT EXISTS (SELECT 1 FROM crm_duplicate_dismissals dd WHERE dd.contact_a = k1.id AND dd.contact_b = k2.id)
  GROUP BY k1.id, k2.id
  LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.crm_merge_contacts(_org uuid, _keep uuid, _drop uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k crm_contacts; d crm_contacts;
BEGIN
  IF NOT (has_org_permission(_org, 'crm.update') AND has_org_permission(_org, 'crm.delete')) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF _keep = _drop THEN RAISE EXCEPTION 'Escolha dois contatos diferentes' USING ERRCODE = '23514'; END IF;
  SELECT * INTO k FROM crm_contacts WHERE id = _keep AND organization_id = _org AND merged_into_id IS NULL FOR UPDATE;
  SELECT * INTO d FROM crm_contacts WHERE id = _drop AND organization_id = _org AND merged_into_id IS NULL FOR UPDATE;
  IF k.id IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'Contato não encontrado' USING ERRCODE = 'P0002'; END IF;
  UPDATE crm_deals SET contact_id = _keep WHERE contact_id = _drop;
  UPDATE crm_interactions SET contact_id = _keep WHERE contact_id = _drop;
  UPDATE crm_reminders SET contact_id = _keep WHERE contact_id = _drop;
  UPDATE crm_contact_channels SET contact_id = _keep, is_primary = false WHERE contact_id = _drop;
  INSERT INTO crm_contact_tags(contact_id, tag_id, organization_id) SELECT _keep, tag_id, _org FROM crm_contact_tags WHERE contact_id = _drop ON CONFLICT DO NOTHING;
  DELETE FROM crm_contact_tags WHERE contact_id = _drop;
  UPDATE files SET crm_contact_id = _keep WHERE crm_contact_id = _drop AND organization_id = _org;
  INSERT INTO crm_contact_private(contact_id, organization_id, doc)
    SELECT _keep, _org, doc FROM crm_contact_private WHERE contact_id = _drop AND doc IS NOT NULL
    ON CONFLICT (contact_id) DO UPDATE SET doc = coalesce(crm_contact_private.doc, EXCLUDED.doc);
  -- Dados do contato removido viram canais adicionais quando diferentes.
  INSERT INTO crm_contact_channels(organization_id, contact_id, type, value, label)
  SELECT _org, _keep, t, v, 'other' FROM (VALUES ('email', d.email), ('phone', d.phone), ('whatsapp', d.whatsapp)) x(t, v)
  WHERE v IS NOT NULL AND btrim(v) <> ''
    AND (CASE WHEN t = 'email' THEN crm_email_norm(v) ELSE crm_phone_norm(v) END) IS DISTINCT FROM
        (CASE t WHEN 'email' THEN k.email_norm WHEN 'phone' THEN k.phone_digits ELSE k.whatsapp_digits END);
  UPDATE crm_contacts SET
    trade_name = coalesce(trade_name, d.trade_name), source = coalesce(source, d.source), category = coalesce(category, d.category),
    notes = CASE WHEN d.notes IS NULL THEN notes WHEN notes IS NULL THEN d.notes ELSE notes || E'\n\n' || d.notes END,
    preferences = coalesce(preferences, d.preferences), owner_id = coalesce(owner_id, d.owner_id),
    address_street = coalesce(address_street, d.address_street), address_number = coalesce(address_number, d.address_number),
    address_city = coalesce(address_city, d.address_city), address_state = coalesce(address_state, d.address_state),
    address_zip = coalesce(address_zip, d.address_zip), address_district = coalesce(address_district, d.address_district)
  WHERE id = _keep;
  UPDATE crm_contacts SET merged_into_id = _keep, archived_at = coalesce(archived_at, now()) WHERE id = _drop;
  PERFORM crm_log(_org, _keep, NULL, 'contacts_merged', 'Contato unificado com "' || d.name || '"', jsonb_build_object('merged_id', _drop));
  PERFORM write_audit(_org, 'crm.contacts_merged', 'crm_contacts', _keep, jsonb_build_object('merged_id', _drop));
END $$;

CREATE OR REPLACE FUNCTION public.crm_archive_stage(_org uuid, _stage uuid, _target uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; s crm_pipeline_stages;
BEGIN
  IF NOT has_org_permission(_org, 'crm.manage') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  SELECT * INTO s FROM crm_pipeline_stages WHERE id = _stage AND organization_id = _org AND archived_at IS NULL FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Etapa não encontrada' USING ERRCODE = 'P0002'; END IF;
  SELECT count(*) INTO n FROM crm_deals WHERE stage_id = _stage;
  IF n > 0 THEN
    IF _target IS NULL OR _target = _stage OR NOT EXISTS (SELECT 1 FROM crm_pipeline_stages WHERE id = _target AND organization_id = _org AND archived_at IS NULL) THEN
      RAISE EXCEPTION 'Escolha uma etapa ativa para receber as oportunidades' USING ERRCODE = '23514';
    END IF;
    UPDATE crm_deals SET stage_id = _target WHERE stage_id = _stage;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM crm_pipeline_stages WHERE organization_id = _org AND archived_at IS NULL AND id <> _stage AND kind = 'open') THEN
    RAISE EXCEPTION 'É preciso manter ao menos uma etapa em aberto' USING ERRCODE = '23514';
  END IF;
  UPDATE crm_pipeline_stages SET archived_at = now() WHERE id = _stage;
  PERFORM write_audit(_org, 'crm.stage_archived', 'crm_pipeline_stages', _stage, jsonb_build_object('moved', n, 'target', _target));
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.crm_reorder_stages(_org uuid, _ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_org_permission(_org, 'crm.manage') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  UPDATE crm_pipeline_stages s SET position = x.ord FROM unnest(_ids) WITH ORDINALITY x(id, ord)
  WHERE s.id = x.id AND s.organization_id = _org;
END $$;

-- Entrada de contatos vindos de integrações futuras (formulários, páginas, campanhas).
CREATE OR REPLACE FUNCTION public.crm_intake(_org uuid, _source text, _payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE errs text[] := '{}'; nm text := btrim(coalesce(_payload->>'name',''));
  em text := nullif(btrim(coalesce(_payload->>'email','')), ''); ph text := nullif(btrim(coalesce(_payload->>'phone','')), '');
  wa text := nullif(btrim(coalesce(_payload->>'whatsapp','')), ''); dc text := nullif(btrim(coalesce(_payload->>'doc','')), '');
  src text := nullif(btrim(coalesce(_source,'')), ''); m uuid; cid uuid;
BEGIN
  IF NOT has_org_permission(_org, 'crm.create') THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501'; END IF;
  IF src IS NULL OR length(src) > 60 THEN errs := errs || 'origem obrigatória'; END IF;
  IF nm = '' OR length(nm) > 200 THEN errs := errs || 'nome obrigatório'; END IF;
  IF em IS NULL AND ph IS NULL AND wa IS NULL THEN errs := errs || 'informe e-mail, telefone ou WhatsApp'; END IF;
  IF em IS NOT NULL AND crm_email_norm(em) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN errs := errs || 'e-mail inválido'; END IF;
  IF dc IS NOT NULL AND NOT crm_valid_doc(dc) THEN errs := errs || 'CPF/CNPJ inválido'; END IF;
  IF cardinality(errs) > 0 THEN
    INSERT INTO crm_intake_log(organization_id, source, payload, result, errors) VALUES (_org, coalesce(src,'desconhecida'), coalesce(_payload,'{}'), 'rejected', errs);
    RETURN jsonb_build_object('status','rejected','errors', to_jsonb(errs));
  END IF;
  SELECT f.id INTO m FROM crm_find_duplicates(_org, em, ph, wa, dc, NULL) f WHERE NOT f.archived LIMIT 1;
  IF m IS NOT NULL THEN
    PERFORM crm_log(_org, m, NULL, 'intake_matched', 'Novo contato recebido de ' || src || ' (cadastro existente)', jsonb_build_object('source', src));
    INSERT INTO crm_intake_log(organization_id, source, payload, result, contact_id) VALUES (_org, src, _payload, 'matched', m);
    RETURN jsonb_build_object('status','matched','contact_id', m);
  END IF;
  INSERT INTO crm_contacts(organization_id, kind, name, email, phone, whatsapp, source, relationship, notes)
  VALUES (_org, CASE WHEN length(regexp_replace(coalesce(dc,''),'[^0-9]','','g')) = 14 THEN 'pj' ELSE 'pf' END,
          nm, em, ph, wa, src, 'lead', nullif(btrim(coalesce(_payload->>'message','')), ''))
  RETURNING id INTO cid;
  IF dc IS NOT NULL THEN INSERT INTO crm_contact_private(contact_id, organization_id, doc) VALUES (cid, _org, dc); END IF;
  INSERT INTO crm_intake_log(organization_id, source, payload, result, contact_id) VALUES (_org, src, _payload, 'created', cid);
  RETURN jsonb_build_object('status','created','contact_id', cid);
END $$;

GRANT EXECUTE ON FUNCTION public.crm_find_duplicates(uuid,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_duplicate_pairs(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_merge_contacts(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_archive_stage(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_reorder_stages(uuid,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_intake(uuid,text,jsonb) TO authenticated;
