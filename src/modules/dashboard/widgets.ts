/** Catálogo de widgets do painel. Cada widget pertence a um módulo e exige uma permissão. */
export type WidgetStatus = "pending_module" | "ready";
export type WidgetDef = {
  key: string;
  title: string;
  module: string;
  permission: string;
  size: 1 | 2;
  /** pending_module = o módulo de origem ainda não tem telas/tabelas; nenhum dado é exibido. */
  status: WidgetStatus;
  emptyHint: string;
};

export const WIDGETS: WidgetDef[] = [
  { key: "revenue", title: "Faturamento do período", module: "financeiro", permission: "financeiro.read", size: 1, status: "pending_module", emptyHint: "Registre recebimentos para acompanhar o faturamento." },
  { key: "receivables", title: "Recebimentos pendentes", module: "financeiro", permission: "financeiro.read", size: 1, status: "pending_module", emptyHint: "Cobranças em aberto aparecerão aqui." },
  { key: "expenses", title: "Despesas", module: "financeiro", permission: "financeiro.read", size: 1, status: "pending_module", emptyHint: "Lance suas despesas para ver o total do período." },
  { key: "balance", title: "Saldo financeiro", module: "financeiro", permission: "financeiro.read", size: 1, status: "pending_module", emptyHint: "O saldo é calculado a partir de receitas e despesas." },
  { key: "appointments", title: "Próximos compromissos", module: "agenda", permission: "agenda.read", size: 1, status: "pending_module", emptyHint: "Crie compromissos na agenda." },
  { key: "events", title: "Próximos eventos", module: "agenda", permission: "agenda.read", size: 1, status: "pending_module", emptyHint: "Eventos contratados aparecerão aqui." },
  { key: "leads", title: "Leads recentes", module: "crm", permission: "crm.read", size: 1, status: "ready", emptyHint: "Nenhum lead cadastrado no período. Cadastre seu primeiro contato em Clientes." },
  { key: "crm_activities", title: "Atividades e lembretes", module: "crm", permission: "crm.read", size: 2, status: "ready", emptyHint: "Nenhum lembrete. Crie lembretes na ficha dos seus contatos." },
  { key: "proposals", title: "Propostas aguardando resposta", module: "comercial", permission: "comercial.read", size: 1, status: "pending_module", emptyHint: "Envie propostas para acompanhar respostas." },
  { key: "contracts", title: "Contratos pendentes", module: "comercial", permission: "comercial.read", size: 1, status: "pending_module", emptyHint: "Contratos aguardando assinatura aparecerão aqui." },
  { key: "commercial_kpis", title: "Indicadores comerciais", module: "crm", permission: "crm.read", size: 2, status: "ready", emptyHint: "Crie oportunidades no Pipeline para acompanhar os indicadores." },
  { key: "overdue_tasks", title: "Tarefas atrasadas", module: "producao", permission: "producao.read", size: 1, status: "pending_module", emptyHint: "Crie tarefas com prazo para acompanhar atrasos." },
  { key: "deliveries", title: "Entregas próximas", module: "producao", permission: "producao.read", size: 1, status: "pending_module", emptyHint: "Entregas com prazo definido aparecerão aqui." },
];

export const WIDGET_KEYS = WIDGETS.map((w) => w.key);

/** Widgets permitidos: módulo ativo na organização E permissão do usuário. */
export function allowedWidgets(enabledModules: string[], permissions: string[]): WidgetDef[] {
  const mods = new Set(enabledModules);
  const perms = new Set(permissions);
  return WIDGETS.filter((w) => mods.has(w.module) && perms.has(w.permission));
}

export type LayoutItem = { key: string; visible: boolean };

/** Mescla o layout salvo com os widgets permitidos: descarta chaves inválidas, acrescenta novos ao final. */
export function resolveLayout(saved: unknown, allowed: WidgetDef[]): LayoutItem[] {
  const allowedKeys = new Set(allowed.map((w) => w.key));
  const out: LayoutItem[] = [];
  const seen = new Set<string>();
  if (Array.isArray(saved)) {
    for (const it of saved) {
      if (!it || typeof it !== "object") continue;
      const { key, visible } = it as Record<string, unknown>;
      if (typeof key !== "string" || !allowedKeys.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push({ key, visible: visible !== false });
    }
  }
  for (const w of allowed) if (!seen.has(w.key)) out.push({ key: w.key, visible: true });
  return out;
}

export type PeriodPreset = "this_month" | "last_month" | "last_30" | "this_year" | "custom";

function todayIn(tz: string, now: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const [y, m, d] = p.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}
const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);

/** Intervalo [from, to] em datas (YYYY-MM-DD) no fuso da organização. */
export function periodRange(preset: PeriodPreset, tz: string, now = new Date(), custom?: { from?: string | undefined; to?: string | undefined }) {
  const { y, m, d } = todayIn(tz, now);
  switch (preset) {
    case "last_month": return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
    case "last_30": return { from: iso(y, m, d - 29), to: iso(y, m, d) };
    case "this_year": return { from: iso(y, 1, 1), to: iso(y, 12, 31) };
    case "custom":
      if (custom?.from && custom?.to && custom.from <= custom.to) return { from: custom.from, to: custom.to };
      return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
    default: return { from: iso(y, m, 1), to: iso(y, m + 1, 0) };
  }
}
