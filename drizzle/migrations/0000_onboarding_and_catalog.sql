-- Catálogo de sistema (definição do produto): restaurado após o remix e ampliado com módulos futuros.
INSERT INTO public.modules(key, name, description, is_core, is_available, sort_order) VALUES
 ('core','Núcleo','Organização, equipe e configurações',true,true,0),
 ('crm','CRM','Clientes, contatos e relacionamento',true,true,10),
 ('comercial','Comercial','Serviços, propostas e orçamentos',false,true,20),
 ('agenda','Agenda','Compromissos, eventos e disponibilidade',false,true,30),
 ('producao','Produção e entregas','Projetos, tarefas, prazos e entregas',false,true,40),
 ('financeiro','Financeiro','Receitas, despesas, cobranças e parcelas',false,true,50),
 ('documentos','Documentos e contratos','Modelos, contratos e aceites',false,true,60),
 ('ia','Inteligência Artificial','Assistente e sugestões',false,true,70),
 ('alunos','Alunos','Cadastro de alunos e matrículas',false,false,80),
 ('turmas','Turmas e aulas','Turmas, aulas e horários',false,false,81),
 ('frequencia','Frequência','Controle de presença',false,false,82),
 ('galerias','Galerias','Entrega de fotos e galerias',false,false,83),
 ('sites','Construtor de sites','Sites e páginas',false,false,90)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.module_dependencies(module_key, depends_on) VALUES
 ('crm','core'),('comercial','crm'),('agenda','crm'),('producao','comercial'),('producao','agenda'),
 ('financeiro','comercial'),('documentos','comercial'),('ia','core'),('sites','crm'),('sites','comercial'),
 ('alunos','crm'),('turmas','alunos'),('turmas','agenda'),('frequencia','turmas'),('galerias','producao')
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions(key, module_key, description)
SELECT m.key || '.' || o.op, m.key, o.op FROM public.modules m
CROSS JOIN (VALUES ('read'),('create'),('update'),('delete'),('manage')) o(op)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions(role, permission_key)
SELECT 'owner'::public.org_role, key FROM public.permissions
UNION ALL SELECT 'admin', key FROM public.permissions WHERE key <> 'core.manage'
UNION ALL SELECT 'manager', key FROM public.permissions WHERE split_part(key,'.',2) IN ('read','create','update','delete') AND module_key <> 'core'
UNION ALL SELECT 'manager', 'core.read'
UNION ALL SELECT 'collaborator', key FROM public.permissions WHERE split_part(key,'.',2) IN ('read','create','update') AND module_key IN ('crm','comercial','agenda','producao','documentos','ia','alunos','turmas','frequencia','galerias')
UNION ALL SELECT 'collaborator', 'core.read'
UNION ALL SELECT 'freelancer', k FROM (VALUES ('core.read'),('agenda.read'),('producao.read'),('producao.update'),('documentos.read')) v(k)
ON CONFLICT DO NOTHING;

-- Modelos de segmento: configuração por dados, sem código por profissão.
CREATE TABLE public.segment_templates (
  key text PRIMARY KEY,
  name text NOT NULL,
  description text,
  modules text[] NOT NULL DEFAULT '{}',
  future_modules text[] NOT NULL DEFAULT '{}',
  flows jsonb NOT NULL DEFAULT '[]'::jsonb,
  billing_suggestions text[] NOT NULL DEFAULT '{}',
  sensitive_data boolean NOT NULL DEFAULT false,
  privacy_notice text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.segment_templates TO authenticated;
GRANT ALL ON public.segment_templates TO service_role;
ALTER TABLE public.segment_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "templates read" ON public.segment_templates FOR SELECT TO authenticated USING (true);

INSERT INTO public.segment_templates(key,name,description,modules,future_modules,flows,billing_suggestions,sensitive_data,privacy_notice,sort_order) VALUES
('fotografia_eventos','Fotografia e cobertura de eventos','Fotógrafos, videomakers, cobertura de stories e eventos',
 ARRAY['crm','comercial','agenda','producao','financeiro','documentos'], ARRAY['galerias'],
 '[{"key":"evento","name":"Do contato à entrega","steps":["Contato","Proposta","Contrato e sinal","Evento","Produção","Entrega"]}]',
 ARRAY['Pacote fechado','Por hora','Sinal + saldo'], false, NULL, 10),
('aulas','Aulas, academias e treinos','Professores, academias, artes marciais e cursos',
 ARRAY['crm','agenda','financeiro'], ARRAY['alunos','turmas','frequencia'],
 '[{"key":"matricula","name":"Matrícula e mensalidade","steps":["Interessado","Aula experimental","Matrícula","Mensalidade recorrente"]}]',
 ARRAY['Mensalidade','Pacote de aulas','Aula avulsa'], false, NULL, 20),
('saude','Saúde e bem-estar','Psicólogos, nutricionistas, fisioterapeutas e terapeutas',
 ARRAY['crm','agenda','documentos','financeiro'], ARRAY[]::text[],
 '[{"key":"atendimento","name":"Agendamento e atendimento","steps":["Primeiro contato","Agendamento","Atendimento","Retorno"]}]',
 ARRAY['Por sessão','Pacote de sessões','Convênio'], true,
 'Dados de saúde são sensíveis pela LGPD. Prontuários não serão guardados como cadastro comum: exigem controles próprios, previstos para uma fase futura.', 30),
('consultoria','Consultoria e serviços profissionais','Consultores, designers, advogados, contadores',
 ARRAY['crm','comercial','agenda','producao','financeiro','documentos'], ARRAY[]::text[],
 '[{"key":"projeto","name":"Proposta e projeto","steps":["Lead","Proposta","Contrato","Execução","Entrega","Cobrança"]}]',
 ARRAY['Por projeto','Por hora','Mensalidade (retainer)'], false, NULL, 40),
('beleza','Beleza e estética','Salões, maquiadores, esteticistas',
 ARRAY['crm','agenda','comercial','financeiro'], ARRAY[]::text[],
 '[{"key":"agendamento","name":"Agendamento e atendimento","steps":["Agendamento","Confirmação","Atendimento","Pagamento"]}]',
 ARRAY['Por serviço','Pacote','Assinatura'], false, NULL, 50),
('generico','Outro segmento','Configuração inicial genérica',
 ARRAY['crm','comercial','agenda','financeiro'], ARRAY[]::text[],
 '[{"key":"venda","name":"Venda de serviço","steps":["Contato","Proposta","Execução","Cobrança"]}]',
 ARRAY['Por serviço','Por hora','Mensalidade'], false, NULL, 99);

-- Respostas e decisões do onboarding (uma linha por organização).
CREATE TABLE public.organization_onboarding (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  current_step integer NOT NULL DEFAULT 0,
  business_name text,
  segment_key text REFERENCES public.segment_templates(key),
  main_activity text,
  services text[] NOT NULL DEFAULT '{}',
  audience text[] NOT NULL DEFAULT '{}',
  billing_models text[] NOT NULL DEFAULT '{}',
  team_size text CHECK (team_size IS NULL OR team_size IN ('solo','2-5','6-15','16+')),
  pains text[] NOT NULL DEFAULT '{}',
  admin_needs text[] NOT NULL DEFAULT '{}',
  finance_needs text[] NOT NULL DEFAULT '{}',
  marketing_needs text[] NOT NULL DEFAULT '{}',
  recommendation jsonb,
  decisions jsonb,
  completed_at timestamptz,
  completed_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.organization_onboarding TO authenticated;
GRANT ALL ON public.organization_onboarding TO service_role;
ALTER TABLE public.organization_onboarding ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding read" ON public.organization_onboarding FOR SELECT TO authenticated
  USING (public.has_org_permission(organization_id, 'core.read'));
CREATE POLICY "onboarding insert" ON public.organization_onboarding FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]) AND status = 'in_progress');
CREATE POLICY "onboarding update" ON public.organization_onboarding FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]) AND status = 'in_progress')
  WITH CHECK (public.has_org_role(organization_id, ARRAY['owner','admin']::public.org_role[]) AND status = 'in_progress');
CREATE TRIGGER organization_onboarding_updated BEFORE UPDATE ON public.organization_onboarding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Configurações preparadas pela plataforma para uma organização específica (ex.: tenant de validação).
-- Sem acesso direto: só a organização vinculada lê via função.
CREATE TABLE public.organization_presets (
  key text PRIMARY KEY,
  name text NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  segment_key text REFERENCES public.segment_templates(key),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.organization_presets TO service_role;
ALTER TABLE public.organization_presets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_org_preset(_org uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('key', p.key, 'name', p.name, 'segment_key', p.segment_key, 'settings', p.settings)
  FROM public.organization_presets p
  WHERE p.organization_id = _org AND public.has_org_role(_org, ARRAY['owner','admin']::public.org_role[])
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_org_preset(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_preset(uuid) TO authenticated;

-- Conclusão atômica: ativa módulos aceitos (com dependências), grava configurações e audita.
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  _org uuid, _business_name text, _segment text, _modules text[], _interests text[], _settings jsonb, _decisions jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _k text; _allowed text[] := ARRAY['currency','timezone','date_format','locale','flows','module_interests','service_packages','commercial_terms','preset_applied'];
  _final text[];
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
  IF NOT public.has_org_role(_org, ARRAY['owner','admin']::public.org_role[]) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(_business_name),'') = '' OR length(_business_name) > 120 THEN RAISE EXCEPTION 'invalid_name' USING ERRCODE = '23514'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.segment_templates WHERE key = _segment) THEN RAISE EXCEPTION 'invalid_segment' USING ERRCODE = '23514'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_modules,'{}')) k WHERE NOT EXISTS (SELECT 1 FROM public.modules m WHERE m.key = k AND m.is_available)) THEN
    RAISE EXCEPTION 'invalid_module' USING ERRCODE = '23514';
  END IF;
  IF jsonb_typeof(coalesce(_settings,'{}'::jsonb)) <> 'object' THEN RAISE EXCEPTION 'invalid_settings' USING ERRCODE = '23514'; END IF;
  FOR _k IN SELECT jsonb_object_keys(coalesce(_settings,'{}'::jsonb)) LOOP
    IF NOT (_k = ANY(_allowed)) THEN RAISE EXCEPTION 'invalid_setting_key' USING ERRCODE = '23514'; END IF;
  END LOOP;

  -- fecha o conjunto com dependências disponíveis + módulos núcleo
  WITH RECURSIVE dep(k) AS (
    SELECT unnest(coalesce(_modules,'{}')) UNION
    SELECT d.depends_on FROM public.module_dependencies d JOIN dep ON d.module_key = dep.k
  )
  SELECT array_agg(DISTINCT m.key) INTO _final FROM public.modules m
  WHERE m.is_available AND (m.is_core OR m.key IN (SELECT k FROM dep));

  INSERT INTO public.organization_modules(organization_id, module_key, enabled)
  SELECT _org, m.key, m.key = ANY(_final) FROM public.modules m WHERE m.is_available
  ON CONFLICT (organization_id, module_key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();

  INSERT INTO public.organization_settings(organization_id, key, value, updated_by)
  SELECT _org, e.key, e.value, _uid FROM jsonb_each(coalesce(_settings,'{}'::jsonb)) e
  UNION ALL SELECT _org, 'module_interests', to_jsonb(coalesce(_interests,'{}')), _uid
    WHERE NOT (coalesce(_settings,'{}'::jsonb) ? 'module_interests')
  ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value, updated_by = _uid, updated_at = now();

  UPDATE public.organizations SET name = trim(_business_name), segment = _segment WHERE id = _org;

  INSERT INTO public.organization_onboarding(organization_id, business_name, segment_key)
  VALUES (_org, trim(_business_name), _segment) ON CONFLICT (organization_id) DO NOTHING;
  UPDATE public.organization_onboarding SET status = 'completed', business_name = trim(_business_name), segment_key = _segment,
    decisions = _decisions, completed_at = now(), completed_by = _uid, updated_by = _uid
  WHERE organization_id = _org;

  PERFORM public.write_audit(_org, 'onboarding.completed', 'organization', _org,
    jsonb_build_object('modules', to_jsonb(_final), 'segment', _segment));
END $$;
REVOKE EXECUTE ON FUNCTION public.complete_onboarding(uuid, text, text, text[], text[], jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(uuid, text, text, text[], text[], jsonb, jsonb) TO authenticated;

-- Preset do primeiro tenant de validação: só com dados informados pela própria profissional.
-- Fica sem organização até a plataforma vinculá-lo à organização dela.
INSERT INTO public.organization_presets(key, name, segment_key, settings) VALUES
('luna-bahia','Luna Bahia','fotografia_eventos', '{
  "service_packages": [
    {"name":"MADELEINE","hours":6,"price_cents":150000,"plus_travel_fee":true},
    {"name":"ÉLOISE","hours":8,"price_cents":195000,"plus_travel_fee":true},
    {"name":"BLANCHE","hours":10,"price_cents":250000,"plus_travel_fee":true}
  ],
  "commercial_terms": {
    "extra_hour_cents":30000,
    "cash_discount_percent":5,
    "deposit_percent":30,
    "contract_required":true,
    "stories_delivery":"Dia seguinte ao evento",
    "gallery_delivery_days":7
  }
}'::jsonb);