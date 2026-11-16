import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { archiveStage, deleteStage, getReminderDefault, listDeals, moveDeal, reorderStages, restoreStage, saveStage, setReminderDefault } from "@/modules/crm/pipeline.functions";
import { brl } from "@/modules/crm/normalize";
import { DealForm, type DealFormValue } from "@/modules/crm/components/deal-form";
import { brDate, errMsg, memberName, StateMsg, useCrmFilters, useStages } from "@/modules/crm/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/crm/pipeline")({
  head: () => ({ meta: [{ title: "Pipeline — Ateliê" }, { name: "description", content: "Oportunidades por etapa." }, { property: "og:title", content: "Pipeline — Ateliê" }, { property: "og:description", content: "Oportunidades por etapa." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: PipelinePage,
});

type Deal = Awaited<ReturnType<typeof listDeals>>[number];

function PipelinePage() {
  const { org, can } = useOrg();
  const qc = useQueryClient();
  const stages = useStages();
  const members = useCrmFilters().data?.members;
  const dealsFn = useServerFn(listDeals);
  const moveFn = useServerFn(moveDeal);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [q, setQ] = useState(""); const [owner, setOwner] = useState("all");
  const [sort, setSort] = useState<{ k: "title" | "value" | "stage" | "close"; asc: boolean }>({ k: "stage", asc: true });
  const [edit, setEdit] = useState<DealFormValue | null>(null);
  const [lost, setLost] = useState<{ id: string; stageId: string } | null>(null);
  const [reason, setReason] = useState("");
  const [manage, setManage] = useState(false);
  const deals = useQuery({ queryKey: ["crm-deals", org.id, "all"], queryFn: () => dealsFn({ data: { organizationId: org.id } }), enabled: can("crm.read") });
  const refresh = () => ["crm-deals", "crm-rem", "dashboard-data", "crm-stages"].forEach((k) => qc.invalidateQueries({ queryKey: [k, org.id] }));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));
  const stageList = stages.data ?? [];
  const pos = (id: string) => stageList.findIndex((s) => s.id === id);

  const filtered = useMemo(() => (deals.data ?? []).filter((d) =>
    (owner === "all" || d.owner_id === owner) &&
    (!q || d.title.toLowerCase().includes(q.toLowerCase()) || (d.crm_contacts as { name: string } | null)?.name.toLowerCase().includes(q.toLowerCase()))), [deals.data, q, owner]);

  async function move(d: Deal, stageId: string) {
    if (d.stage_id === stageId) return;
    if (stageList.find((s) => s.id === stageId)?.kind === "lost") { setReason(d.lost_reason ?? ""); setLost({ id: d.id, stageId }); return; }
    try { await moveFn({ data: { organizationId: org.id, dealId: d.id, stageId } }); refresh();
      if (stageList.find((s) => s.id === stageId)?.kind === "won") toast.success("Contratado! Um lembrete de próximos passos foi criado.");
    } catch (e) { toast.error(errMsg(e)); }
  }
  function onDragEnd(e: DragEndEvent) {
    const d = filtered.find((x) => x.id === e.active.id);
    if (d && e.over) move(d, String(e.over.id));
  }
  if (!can("crm.read")) return <p className="text-muted-foreground">Sem acesso.</p>;

  const sorted = [...filtered].sort((a, b) => {
    const v = sort.k === "title" ? a.title.localeCompare(b.title) : sort.k === "value" ? (a.value_cents ?? 0) - (b.value_cents ?? 0)
      : sort.k === "close" ? (a.expected_close_date ?? "").localeCompare(b.expected_close_date ?? "") : pos(a.stage_id) - pos(b.stage_id);
    return sort.asc ? v : -v;
  });
  const th = (k: typeof sort.k, l: string) => <th className="p-3"><button onClick={() => setSort((s) => ({ k, asc: s.k === k ? !s.asc : true }))}>{l}{sort.k === k ? (sort.asc ? " ↑" : " ↓") : ""}</button></th>;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-4xl">Pipeline</h1><p className="text-sm text-muted-foreground">Arraste os cartões ou use o menu “Mover” (funciona no teclado e no celular).</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant={view === "kanban" ? "default" : "outline"} onClick={() => setView("kanban")}>Kanban</Button>
          <Button variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")}>Tabela</Button>
          {can("crm.manage") && <Button variant="outline" onClick={() => setManage(true)}>Etapas</Button>}
          {can("crm.create") && <Button onClick={() => setEdit({})}>Nova oportunidade</Button>}
        </div>
      </header>
      <div className="flex flex-wrap gap-2">
        <Input className="min-w-56 flex-1" placeholder="Buscar por título ou contato" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <Select value={owner} onValueChange={setOwner}><SelectTrigger className="w-48" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os responsáveis</SelectItem>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <StateMsg loading={deals.isLoading || stages.isLoading} error={deals.error ?? stages.error}
        empty={stageList.length === 0 && "Nenhuma etapa configurada. Ative o CRM para criar as etapas padrão."}>
        {deals.data?.length === 0 && <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Nenhuma oportunidade ainda. Crie a primeira em “Nova oportunidade” ou pela ficha de um contato.</p>}
        {view === "kanban" ? (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {stageList.map((s) => {
                const col = filtered.filter((d) => d.stage_id === s.id);
                return (
                  <Column key={s.id} id={s.id} title={s.name} kind={s.kind} count={col.length} total={col.reduce((a, d) => a + (d.value_cents ?? 0), 0)}>
                    {col.map((d) => (
                      <Card key={d.id} deal={d} owner={memberName(members, d.owner_id)} stages={stageList} canMove={can("crm.update")} onMove={(sid) => move(d, sid)} onEdit={() => setEdit({ ...d })} />
                    ))}
                  </Column>
                );
              })}
            </div>
          </DndContext>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr>{th("title", "Oportunidade")}<th className="p-3">Contato</th>{th("stage", "Etapa")}{th("value", "Valor")}<th className="p-3">Responsável</th>{th("close", "Previsão")}</tr></thead>
              <tbody className="divide-y">
                {sorted.map((d) => (
                  <tr key={d.id} className="hover:bg-muted/40">
                    <td className="p-3"><button className="font-medium hover:underline" onClick={() => setEdit({ ...d })}>{d.title}</button></td>
                    <td className="p-3"><Link to="/app/crm/$contactId" params={{ contactId: d.contact_id }} className="hover:underline">{(d.crm_contacts as { name: string } | null)?.name}</Link></td>
                    <td className="p-3">{stageList.find((s) => s.id === d.stage_id)?.name}</td>
                    <td className="p-3">{brl(d.value_cents)}</td>
                    <td className="p-3">{memberName(members, d.owner_id)}</td>
                    <td className="p-3">{brDate(d.expected_close_date)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t text-xs text-muted-foreground"><td className="p-3" colSpan={3}>{sorted.length} oportunidade(s)</td><td className="p-3">{brl(sorted.reduce((a, d) => a + (d.value_cents ?? 0), 0))}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
        )}
      </StateMsg>

      {edit && <DealForm open onOpenChange={(v) => { if (!v) setEdit(null); }} initial={edit} onSaved={() => { setEdit(null); refresh(); }} />}
      <Dialog open={Boolean(lost)} onOpenChange={(v) => { if (!v) setLost(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Motivo da perda</DialogTitle></DialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: preço, data indisponível…" maxLength={500} />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setLost(null)}>Cancelar</Button>
            <Button onClick={async () => { try { await moveFn({ data: { organizationId: org.id, dealId: lost!.id, stageId: lost!.stageId, lostReason: reason || null } }); setLost(null); refresh(); } catch (e) { toast.error(errMsg(e)); } }}>Marcar como perdida</Button></div>
        </DialogContent>
      </Dialog>
      {manage && <StageManager onClose={() => { setManage(false); refresh(); }} />}
    </section>
  );
}

function Column({ id, title, kind, count, total, children }: { id: string; title: string; kind: string; count: number; total: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`w-72 shrink-0 rounded-xl border bg-muted/40 p-3 ${isOver ? "ring-2 ring-primary" : ""}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title} {kind !== "open" && <Badge variant="outline" className="ml-1">{kind === "won" ? "Ganho" : "Perda"}</Badge>}</p>
        <span className="text-xs text-muted-foreground">{count} · {brl(total)}</span>
      </div>
      <div className="min-h-16 space-y-2">{children}</div>
    </div>
  );
}

function Card({ deal, owner, stages, canMove, onMove, onEdit }: { deal: Deal; owner: string; stages: { id: string; name: string }[]; canMove: boolean; onMove: (id: string) => void; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id, disabled: !canMove });
  return (
    <div ref={setNodeRef} style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className="rounded-lg border bg-card p-3 text-sm shadow-sm">
      <div className={canMove ? "cursor-grab touch-none" : ""} {...listeners} {...attributes} aria-label={`Arrastar ${deal.title}`}>
        <p className="font-medium">{deal.title}</p>
        <p className="text-xs text-muted-foreground">{(deal.crm_contacts as { name: string } | null)?.name}</p>
        <p className="mt-1 text-xs">{brl(deal.value_cents)} · {owner}</p>
        {deal.expected_close_date && <p className="text-xs text-muted-foreground">Previsão {brDate(deal.expected_close_date)}</p>}
      </div>
      <div className="mt-1 flex gap-1">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onEdit}>Abrir</Button>
      {canMove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button size="sm" variant="ghost" className="h-7 px-2 text-xs">Mover</Button></DropdownMenuTrigger>
          <DropdownMenuContent><DropdownMenuLabel>Mover para</DropdownMenuLabel>
            {stages.filter((s) => s.id !== deal.stage_id).map((s) => <DropdownMenuItem key={s.id} onSelect={() => onMove(s.id)}>{s.name}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      </div>
    </div>
  );
}

function StageManager({ onClose }: { onClose: () => void }) {
  const { org } = useOrg();
  const stages = useStages(true);
  const qc = useQueryClient();
  const save = useServerFn(saveStage); const reorder = useServerFn(reorderStages); const archive = useServerFn(archiveStage);
  const restore = useServerFn(restoreStage); const del = useServerFn(deleteStage);
  const getDef = useServerFn(getReminderDefault); const setDef = useServerFn(setReminderDefault);
  const def = useQuery({ queryKey: ["crm-rem-default", org.id], queryFn: () => getDef({ data: { organizationId: org.id } }) });
  const [name, setName] = useState("");
  const [target, setTarget] = useState<Record<string, string>>({});
  const r = () => qc.invalidateQueries({ queryKey: ["crm-stages", org.id] });
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast.success(ok); r(); } catch (e) { toast.error(errMsg(e)); } };
  const active = (stages.data ?? []).filter((s) => !s.archived_at);
  const archived = (stages.data ?? []).filter((s) => s.archived_at);
  const swap = (i: number, d: number) => { const ids = active.map((s) => s.id); if (i + d < 0 || i + d >= ids.length) return; [ids[i], ids[i + d]] = [ids[i + d]!, ids[i]!]; run(() => reorder({ data: { organizationId: org.id, ids } })); };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Etapas do pipeline</DialogTitle></DialogHeader>
        <ul className="space-y-2">
          {active.map((s, i) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
              <Button size="sm" variant="ghost" aria-label="Subir" onClick={() => swap(i, -1)}>↑</Button>
              <Button size="sm" variant="ghost" aria-label="Descer" onClick={() => swap(i, 1)}>↓</Button>
              <Input className="w-44" defaultValue={s.name} aria-label="Nome da etapa" onBlur={(e) => e.target.value.trim() && e.target.value !== s.name && run(() => save({ data: { organizationId: org.id, stageId: s.id, name: e.target.value, kind: s.kind as "open" } }), "Etapa renomeada.")} />
              <Select value={s.kind} onValueChange={(v) => run(() => save({ data: { organizationId: org.id, stageId: s.id, name: s.name, kind: v as "open" } }))}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="open">Aberta</SelectItem><SelectItem value="won">Ganho</SelectItem><SelectItem value="lost">Perda</SelectItem></SelectContent>
              </Select>
              <Select value={target[s.id] ?? ""} onValueChange={(v) => setTarget((t) => ({ ...t, [s.id]: v }))}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Transferir para…" /></SelectTrigger>
                <SelectContent>{active.filter((x) => x.id !== s.id).map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => run(() => archive({ data: { organizationId: org.id, stageId: s.id, targetId: target[s.id] ?? null } }), "Etapa arquivada.")}>Arquivar</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => confirm(`Excluir a etapa "${s.name}"?`) && run(() => del({ data: { organizationId: org.id, stageId: s.id } }), "Etapa excluída.")}>Excluir</Button>
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) run(() => save({ data: { organizationId: org.id, name, kind: "open" } }), "Etapa criada.").then(() => setName("")); }}>
          <Input placeholder="Nova etapa" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /><Button type="submit">Criar</Button>
        </form>
        {archived.length > 0 && (
          <div className="space-y-1 text-sm"><p className="text-xs text-muted-foreground">Arquivadas</p>
            {archived.map((s) => <div key={s.id} className="flex items-center justify-between"><span>{s.name}</span><Button size="sm" variant="ghost" onClick={() => run(() => restore({ data: { organizationId: org.id, stageId: s.id } }), "Etapa restaurada.")}>Restaurar</Button></div>)}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
          <span>Prazo do lembrete automático ao contratar:</span>
          <Input type="number" min={0} max={365} className="w-20" key={def.data?.days} defaultValue={def.data?.days ?? 2}
            onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 365) run(() => setDef({ data: { organizationId: org.id, days: n } }), "Prazo salvo."); }} />
          <span>dias</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
