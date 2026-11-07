import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveReminder } from "../activity.functions";
import { PRIORITIES } from "../normalize";
import { errMsg, todayISO, useCrmFilters } from "./common";

export type ReminderFormValue = {
  id?: string; contact_id: string; deal_id?: string | null; title?: string; description?: string | null;
  due_date?: string; due_time?: string | null; priority?: "low" | "medium" | "high"; assignee_id?: string | null;
};

export function ReminderForm({ open, onOpenChange, initial, deals, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; initial: ReminderFormValue; deals?: { id: string; title: string }[]; onSaved: () => void;
}) {
  const { org } = useOrg();
  const filters = useCrmFilters();
  const save = useServerFn(saveReminder);
  const [f, setF] = useState<ReminderFormValue>({ priority: "medium", due_date: todayISO(), ...initial });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ReminderFormValue>(k: K, v: ReminderFormValue[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await save({ data: { organizationId: org.id, ...(f.id ? { reminderId: f.id } : {}), reminder: {
        contact_id: f.contact_id, deal_id: f.deal_id ?? null, title: f.title ?? "", description: f.description ?? null,
        due_date: f.due_date ?? "", due_time: f.due_time || null, priority: f.priority ?? "medium", assignee_id: f.assignee_id ?? null,
      } } });
      toast.success(f.id ? "Lembrete atualizado." : "Lembrete criado.");
      onSaved();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{f.id ? "Editar lembrete" : "Novo lembrete"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Título *</Label><Input required maxLength={200} value={f.title ?? ""} onChange={(e) => set("title", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Data *</Label><Input type="date" required value={f.due_date ?? ""} onChange={(e) => set("due_date", e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Horário (opcional)</Label><Input type="time" value={f.due_time?.slice(0, 5) ?? ""} onChange={(e) => set("due_time", e.target.value)} /></div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={f.priority} onValueChange={(v) => set("priority", v as "low")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(PRIORITIES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Responsável</Label>
              <Select value={f.assignee_id ?? "me"} onValueChange={(v) => set("assignee_id", v === "me" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">Eu</SelectItem>
                  {filters.data?.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {deals && deals.length > 0 && (
            <div className="space-y-1.5">
              <Label>Oportunidade (opcional)</Label>
              <Select value={f.deal_id ?? "none"} onValueChange={(v) => set("deal_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {deals.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
