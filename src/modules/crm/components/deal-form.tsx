import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveDeal } from "../pipeline.functions";
import { listContacts } from "../contacts.functions";
import { errMsg, moneyInput, parseMoney, useCrmFilters, useStages } from "./common";

export type DealFormValue = {
  id?: string; contact_id?: string; stage_id?: string; title?: string; description?: string | null; notes?: string | null;
  value_cents?: number | null; owner_id?: string | null; expected_close_date?: string | null; lost_reason?: string | null;
};

export function DealForm({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; initial: DealFormValue; onSaved: () => void }) {
  const { org } = useOrg();
  const stages = useStages();
  const filters = useCrmFilters();
  const save = useServerFn(saveDeal);
  const contactsFn = useServerFn(listContacts);
  const [q, setQ] = useState("");
  const contacts = useQuery({
    queryKey: ["crm-contact-pick", org.id, q],
    queryFn: () => contactsFn({ data: { organizationId: org.id, q: q || undefined, pageSize: 10, sort: "name", dir: "asc" } }),
    enabled: open && !initial.contact_id,
  });
  const [f, setF] = useState<DealFormValue>(initial);
  const [money, setMoney] = useState(moneyInput(initial.value_cents));
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof DealFormValue>(k: K, v: DealFormValue[K]) => setF((x) => ({ ...x, [k]: v }));
  const stageId = f.stage_id ?? stages.data?.[0]?.id;
  const stageKind = stages.data?.find((s) => s.id === stageId)?.kind;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.contact_id) return toast.error("Escolha o contato.");
    if (!stageId) return toast.error("Escolha a etapa.");
    setBusy(true);
    try {
      await save({ data: { organizationId: org.id, ...(f.id ? { dealId: f.id } : {}), deal: {
        contact_id: f.contact_id, stage_id: stageId, title: f.title ?? "", description: f.description ?? null, notes: f.notes ?? null,
        value_cents: parseMoney(money), owner_id: f.owner_id ?? null, expected_close_date: f.expected_close_date || null, lost_reason: f.lost_reason ?? null,
      } } });
      toast.success(f.id ? "Oportunidade atualizada." : "Oportunidade criada.");
      onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{f.id ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!initial.contact_id && (
            <div className="space-y-1.5">
              <Label>Contato *</Label>
              <Input placeholder="Buscar contato…" value={q} onChange={(e) => setQ(e.target.value)} />
              <Select value={f.contact_id ?? ""} onValueChange={(v) => set("contact_id", v)}>
                <SelectTrigger><SelectValue placeholder={contacts.isLoading ? "Carregando…" : "Escolha o contato"} /></SelectTrigger>
                <SelectContent>{contacts.data?.rows.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              {contacts.data && contacts.data.rows.length === 0 && <p className="text-xs text-muted-foreground">Nenhum contato encontrado. Cadastre-o em Clientes.</p>}
            </div>
          )}
          <div className="space-y-1.5"><Label>Título *</Label><Input required maxLength={200} value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Etapa</Label>
              <Select value={stageId ?? ""} onValueChange={(v) => set("stage_id", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{stages.data?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Valor estimado (R$)</Label><Input inputMode="decimal" value={money} onChange={(e) => setMoney(e.target.value)} placeholder="0,00" /></div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={f.owner_id ?? "me"} onValueChange={(v) => set("owner_id", v === "me" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Eu</SelectItem>
                  {filters.data?.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Previsão de fechamento</Label><Input type="date" value={f.expected_close_date ?? ""} onChange={(e) => set("expected_close_date", e.target.value)} /></div>
          </div>
          {stageKind === "lost" && <div className="space-y-1.5"><Label>Motivo da perda</Label><Input value={f.lost_reason ?? ""} onChange={(e) => set("lost_reason", e.target.value)} /></div>}
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
