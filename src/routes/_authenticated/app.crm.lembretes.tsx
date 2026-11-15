import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOrg } from "@/modules/core/org-context";
import { listReminders } from "@/modules/crm/activity.functions";
import { ReminderList, type ReminderRow } from "@/modules/crm/components/reminder-list";
import { ReminderForm, type ReminderFormValue } from "@/modules/crm/components/reminder-form";
import { StateMsg, todayISO, useCrmFilters } from "@/modules/crm/components/common";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const VIEWS = { today: "Hoje", overdue: "Atrasados", upcoming: "Próximos", pending: "Todos pendentes", done: "Concluídos", canceled: "Cancelados", all: "Todos" } as const;

export const Route = createFileRoute("/_authenticated/app/crm/lembretes")({
  head: () => ({ meta: [{ title: "Lembretes — Ateliê" }, { name: "description", content: "Próximas ações e lembretes do CRM." }, { property: "og:title", content: "Lembretes — Ateliê" }, { property: "og:description", content: "Próximas ações e lembretes do CRM." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RemindersPage,
});

function RemindersPage() {
  const { org, can } = useOrg();
  const qc = useQueryClient();
  const fn = useServerFn(listReminders);
  const members = useCrmFilters().data?.members;
  const [view, setView] = useState<keyof typeof VIEWS>("pending");
  const [assignee, setAssignee] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [edit, setEdit] = useState<ReminderFormValue | null>(null);
  const params = { organizationId: org.id, view, today: todayISO(), ...(assignee !== "all" ? { assigneeId: assignee } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
  const q = useQuery({ queryKey: ["crm-rem", org.id, params], queryFn: () => fn({ data: params }), enabled: can("crm.read") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["crm-rem", org.id] }); qc.invalidateQueries({ queryKey: ["dashboard-data", org.id] }); };
  if (!can("crm.read")) return <p className="text-muted-foreground">Sem acesso.</p>;
  return (
    <section className="space-y-6">
      <div><h1 className="text-4xl">Lembretes</h1><p className="text-sm text-muted-foreground">Próximas ações com seus contatos. Para criar, abra a ficha do contato.</p></div>
      <div className="flex flex-wrap gap-2">
        <Select value={view} onValueChange={(v) => setView(v as "pending")}><SelectTrigger className="w-44" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(VIEWS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Select value={assignee} onValueChange={setAssignee}><SelectTrigger className="w-48" aria-label="Responsável"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os responsáveis</SelectItem>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>
        <Input type="date" className="w-40" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-40" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <StateMsg loading={q.isLoading} error={q.error} empty={q.data?.length === 0 && "Nenhum lembrete nesta visão."}>
        <ReminderList rows={(q.data ?? []) as ReminderRow[]} showContact onChanged={refresh} onEdit={(r) => setEdit({ ...r })} />
      </StateMsg>
      {edit && <ReminderForm open onOpenChange={(v) => !v && setEdit(null)} initial={edit} onSaved={() => { setEdit(null); refresh(); }} />}
    </section>
  );
}
