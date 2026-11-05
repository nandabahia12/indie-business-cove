/**
 * Motor de recomendação por regras (sem IA). Puro e testável.
 * Profissões são descritas por dados (segment_templates); aqui só há regras genéricas.
 */
export type OnboardingAnswers = {
  business_name: string | null;
  segment_key: string | null;
  main_activity: string | null;
  services: string[];
  audience: string[];
  billing_models: string[];
  team_size: "solo" | "2-5" | "6-15" | "16+" | null;
  pains: string[];
  admin_needs: string[];
  finance_needs: string[];
  marketing_needs: string[];
};

export type SegmentTemplate = {
  key: string;
  name: string;
  modules: string[];
  future_modules: string[];
  flows: { key: string; name: string; steps: string[] }[];
  sensitive_data: boolean;
  privacy_notice: string | null;
};

export type CatalogModule = { key: string; name: string; is_core: boolean; is_available: boolean };

export type RecommendedModule = { key: string; name: string; reason: string; source: "segmento" | "respostas" | "ia" };

export type Recommendation = {
  modules: RecommendedModule[];
  futureModules: { key: string; name: string; reason: string }[];
  coreModules: { key: string; name: string }[];
  settings: { currency: string; timezone: string; date_format: string; locale: string };
  flows: { key: string; name: string; steps: string[] }[];
  notices: string[];
  aiSummary: string | null;
  aiUsed: boolean;
};

export const DEFAULT_SETTINGS = {
  currency: "BRL",
  timezone: "America/Bahia",
  date_format: "dd/MM/yyyy",
  locale: "pt-BR",
} as const;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const hits = (list: string[], words: string[]) => list.some((v) => words.some((w) => norm(v).includes(w)));

const RULES: { module: string; reason: string; test: (a: OnboardingAnswers) => boolean }[] = [
  {
    module: "financeiro",
    reason: "Você mencionou necessidades financeiras ou dificuldade com pagamentos.",
    test: (a) => a.finance_needs.length > 0 || hits(a.pains, ["pagamento", "cobran", "financ", "inadimpl", "dinheiro", "caixa"]),
  },
  {
    module: "documentos",
    reason: "Você citou contratos ou documentos.",
    test: (a) => hits([...a.admin_needs, ...a.pains], ["contrat", "document", "termo"]),
  },
  {
    module: "agenda",
    reason: "Você citou agenda, horários ou compromissos.",
    test: (a) => hits([...a.admin_needs, ...a.pains], ["agenda", "horari", "compromisso", "agendamento"]),
  },
  {
    module: "producao",
    reason: "Você citou prazos, entregas ou tarefas.",
    test: (a) => hits([...a.admin_needs, ...a.pains], ["prazo", "entrega", "tarefa", "producao", "organiza"]),
  },
  {
    module: "producao",
    reason: "Com equipe, ajuda a distribuir tarefas e acompanhar prazos.",
    test: (a) => a.team_size !== null && a.team_size !== "solo",
  },
  {
    module: "comercial",
    reason: "Você trabalha com propostas, orçamentos ou pacotes.",
    test: (a) => hits([...a.billing_models, ...a.pains, ...a.admin_needs], ["orcamento", "proposta", "pacote", "projeto"]),
  },
];

export function recommend(
  answers: OnboardingAnswers,
  template: SegmentTemplate | null,
  catalog: CatalogModule[],
): Recommendation {
  const byKey = new Map(catalog.map((m) => [m.key, m]));
  const picked = new Map<string, RecommendedModule>();
  const add = (key: string, reason: string, source: RecommendedModule["source"]) => {
    const m = byKey.get(key);
    if (!m || m.is_core || !m.is_available || picked.has(key)) return;
    picked.set(key, { key, name: m.name, reason, source });
  };

  for (const k of template?.modules ?? []) add(k, `Indicado para ${template!.name.toLowerCase()}.`, "segmento");
  for (const r of RULES) if (r.test(answers)) add(r.module, r.reason, "respostas");

  const futureModules = (template?.future_modules ?? [])
    .map((k) => byKey.get(k))
    .filter((m): m is CatalogModule => Boolean(m))
    .map((m) => ({ key: m.key, name: m.name, reason: "Ainda em construção. Registramos seu interesse." }));

  const notices: string[] = [];
  if (template?.sensitive_data && template.privacy_notice) notices.push(template.privacy_notice);

  return {
    modules: [...picked.values()],
    futureModules,
    coreModules: catalog.filter((m) => m.is_core && m.is_available).map((m) => ({ key: m.key, name: m.name })),
    settings: { ...DEFAULT_SETTINGS },
    flows: template?.flows ?? [],
    notices,
    aiSummary: null,
    aiUsed: false,
  };
}
