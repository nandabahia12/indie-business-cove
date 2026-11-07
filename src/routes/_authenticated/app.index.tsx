import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { getDashboard } from "@/modules/onboarding/onboarding.functions";
import { getDashboardData, resetDashboardLayout, saveDashboardLayout } from "@/modules/dashboard/dashboard.functions";
import { periodRange, WIDGETS, type LayoutItem, type PeriodPreset } from "@/modules/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last_30", label: "Últimos 30 dias" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const Route = createFileRoute("/_authenticated/app/")({
  validateSearch: (s: Record<string, unknown>): { period?: PeriodPreset | undefined; from?: string | undefined; to?: string | undefined } => ({
    period: PRESETS.some((p) => p.value === s["period"]) ? (s["period"] as PeriodPreset) : undefined,
    from: isDate(s["from"]) ? s["from"] : undefined,
    to: isDate(s["to"]) ? s["to"] : undefined,
  }),
  component: Home,
});

type Flow = { key: string; name: string; steps: string[] };
type Pkg = { name: string; hours: number; price_cents: number; plus_travel_fee?: boolean };
const DEF = Object.fromEntries(WIDGETS.map((w) => [w.key, w]));
const brDate = (d: string) => d.split("-").reverse().join("/");

function Home() {
  const { org, isAdmin } = useOrg();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/" });
  const qc = useQueryClient();
  const loadBase = useServerFn(getDashboard);
  const loadData = useServerFn(getDashboardData);
  const save = useServerFn(saveDashboardLayout);
  const reset = useServerFn(resetDashboardLayout);

  const base = useQuery({ queryKey: ["dashboard", org.id], queryFn: () => loadBase({ data: { organizationId: org.id } }) });
  const tz = typeof base.data?.settings["timezone"] === "string" ? (base.data.settings["timezone"] as string) : "America/Bahia";
  const preset = search.period ?? "this_month";
  const range = periodRange(preset, tz, new Date(), { from: search.from, to: search.to });
  const dash = useQuery({
    queryKey: ["dashboard-data", org.id, range.from, range.to],
    queryFn: () => loadData({ data: { organizationId: org.id, ...range } }),
  });

  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  useEffect(() => { if (dash.data) setLayout(dash.data.layout); }, [dash.data]);

  const saveMut = useMutation({
    mutationFn: (w: LayoutItem[]) => save({ data: { organizationId: org.id, widgets: w } }),
    onSuccess: () => { toast.success("Painel salvo."); setEditing(false); qc.invalidateQueries({ queryKey: ["dashboard-data", org.id] }); },
    onError: () => toast.error("Não foi possível salvar o painel."),
  });
  const resetMut = useMutation({
    mutationFn: () => reset({ data: { organizationId: org.id } }),
    onSuccess: () => { toast.success("Painel restaurado."); setEditing(false); qc.invalidateQueries({ queryKey: ["dashboard-data", org.id] }); },
    onError: () => toast.error("Não foi possível restaurar."),
  });

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    setLayout((l) => arrayMove(l, l.findIndex((i) => i.key === e.active.id), l.findIndex((i) => i.key === e.over!.id)));
  }
  const move = (i: number, d: number) => setLayout((l) => (i + d < 0 || i + d >= l.length ? l : arrayMove(l, i, i + d)));

  if (base.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (base.error || !base.data) return <p className="text-destructive">Não foi possível carregar o painel.</p>;
  const { modules, settings, onboardingStatus } = base.data;
  const flows = (settings["flows"] as Flow[] | undefined) ?? [];
  const pkgs = (settings["service_packages"] as Pkg[] | undefined) ?? [];
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const statusOf = (k: string) => dash.data?.widgets.find((w) => w.key === k)?.status;
  const shown = editing ? layout : layout.filter((i) => i.visible);

  return (
    <section className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{org.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Período: {brDate(range.from)} a {brDate(range.to)} · Fuso: {tz} · Moeda: BRL</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={(v) => navigate({ search: (p) => ({ ...p, period: v as PeriodPreset }) })}>
            <SelectTrigger className="w-44" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>{PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" aria-label="De" className="w-40" value={search.from ?? range.from} onChange={(e) => navigate({ search: (p) => ({ ...p, from: e.target.value || undefined }) })} />
              <Input type="date" aria-label="Até" className="w-40" value={search.to ?? range.to} onChange={(e) => navigate({ search: (p) => ({ ...p, to: e.target.value || undefined }) })} />
            </>
          )}
          {layout.length > 0 && !editing && <Button variant="outline" onClick={() => setEditing(true)}>Personalizar</Button>}
          {editing && (
            <>
              <Button variant="ghost" onClick={() => { setLayout(dash.data?.layout ?? []); setEditing(false); }}>Cancelar</Button>
              <Button variant="outline" disabled={resetMut.isPending} onClick={() => resetMut.mutate()}>Restaurar padrão</Button>
              <Button disabled={saveMut.isPending} onClick={() => saveMut.mutate(layout)}>Salvar</Button>
            </>
          )}
        </div>
      </header>

      {onboardingStatus !== "completed" && isAdmin && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl">Vamos configurar seu ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Responda algumas perguntas e receba sugestões de módulos.</p>
          <Button asChild className="mt-4"><Link to="/app/onboarding">Começar</Link></Button>
        </div>
      )}

      {dash.data && dash.data.recommendations.length > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="flex items-center gap-2 text-xl"><Sparkles className="h-5 w-5 text-primary" /> Recomendações</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {dash.data.recommendations.map((r) => (
              <li key={r.text} className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs">Fato</span>
                <span>{r.text}</span>
                {r.link && <Link to={r.link} className="text-primary underline-offset-4 hover:underline">Abrir</Link>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Análises da IA aparecerão aqui, sempre identificadas como sugestão.</p>
        </div>
      )}

      <div>
        <h2 className="text-xl">Visão geral</h2>
        {dash.isLoading && <p className="mt-3 text-muted-foreground">Carregando indicadores…</p>}
        {dash.error && <p className="mt-3 text-destructive">Não foi possível carregar os indicadores.</p>}
        {dash.data && layout.length === 0 && (
          <p className="mt-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Nenhum indicador disponível. Os indicadores aparecem conforme os módulos ativos da organização e as suas permissões.
          </p>
        )}
        {dash.data && shown.length === 0 && layout.length > 0 && !editing && (
          <p className="mt-3 text-sm text-muted-foreground">Todos os widgets estão ocultos. Use “Personalizar” para exibi-los.</p>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={shown.map((i) => i.key)} strategy={rectSortingStrategy}>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((item, idx) => (
                <WidgetCard key={item.key} item={item} editing={editing} status={statusOf(item.key)}
                  onToggle={(v) => setLayout((l) => l.map((x) => (x.key === item.key ? { ...x, visible: v } : x)))}
                  onUp={() => move(idx, -1)} onDown={() => move(idx, 1)} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <div>
        <h2 className="text-xl">Seus módulos</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {modules.map((m) => <li key={m.key} className="rounded-full border bg-card px-3 py-1 text-sm">{m.name}</li>)}
        </ul>
      </div>

      {flows.length > 0 && (
        <div>
          <h2 className="text-xl">Seus fluxos</h2>
          {flows.map((f) => <p key={f.key} className="mt-2 text-sm"><span className="font-medium">{f.name}:</span> {f.steps.join(" → ")}</p>)}
        </div>
      )}

      {pkgs.length > 0 && (
        <div>
          <h2 className="text-xl">Pacotes configurados</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {pkgs.map((p) => (
              <li key={p.name} className="rounded-md bg-secondary p-3 text-sm">
                <p className="font-medium">{p.name}</p>
                <p>{p.hours}h · {brl(p.price_cents)}{p.plus_travel_fee ? " + deslocamento" : ""}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function WidgetCard({ item, editing, status, onToggle, onUp, onDown }: {
  item: LayoutItem; editing: boolean; status?: string | undefined; onToggle: (v: boolean) => void; onUp: () => void; onDown: () => void;
}) {
  const def = DEF[item.key]!;
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.key, disabled: !editing });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-xl border bg-card p-5 ${def.size === 2 ? "sm:col-span-2" : ""} ${editing && !item.visible ? "opacity-50" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{def.title}</p>
        {editing && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Arrastar" className="cursor-grab p-1 text-muted-foreground" {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></button>
            <button type="button" aria-label="Mover para cima" className="p-1 text-muted-foreground" onClick={onUp}><ArrowUp className="h-4 w-4" /></button>
            <button type="button" aria-label="Mover para baixo" className="p-1 text-muted-foreground" onClick={onDown}><ArrowDown className="h-4 w-4" /></button>
            <Switch aria-label="Exibir" checked={item.visible} onCheckedChange={onToggle} />
          </div>
        )}
      </div>
      {status === "pending_module" ? (
        <p className="mt-3 text-sm text-muted-foreground">Em breve. Este módulo está em construção; os dados aparecerão aqui automaticamente.</p>
      ) : !value || value.total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{def.emptyHint}</p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          {value.kind === "kpis" && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {value.stats.map((s) => (
                <div key={s.label} className="rounded-md bg-secondary p-3">
                  <dt className="text-xs text-muted-foreground">{s.label}</dt>
                  <dd className="text-xl font-medium">{s.value}</dd>
                  {s.money != null && <dd className="text-xs text-muted-foreground">{brl(s.money)}</dd>}
                </div>
              ))}
            </dl>
          )}
          {value.kind === "kpis" && value.byStage && (
            <ul className="flex flex-wrap gap-2 text-xs">
              {value.byStage.map((s) => <li key={s.name} className="rounded-full border px-2 py-0.5">{s.name}: {s.count}</li>)}
            </ul>
          )}
          {(value.items?.length ?? 0) > 0 && (
            <ul className="divide-y">
              {value.items!.map((it, i) => (
                <li key={`${it.id}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                  <Link to="/app/crm/$contactId" params={{ contactId: it.id }} className="truncate hover:underline">
                    {it.label}{it.extra ? <span className="text-muted-foreground"> · {it.extra}</span> : null}
                  </Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{brDate(it.sub.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to={item.key === "commercial_kpis" ? "/app/crm/pipeline" : item.key === "crm_activities" ? "/app/crm/lembretes" : "/app/crm"} className="text-xs text-primary hover:underline">Ver tudo</Link>
        </div>
      )}
    </li>
  );
}
