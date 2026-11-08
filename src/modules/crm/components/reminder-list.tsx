import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { setReminderStatus } from "../activity.functions";
import { PRIORITIES } from "../normalize";
import { brDate, errMsg, memberName, todayISO, useCrmFilters } from "./common";

export type ReminderRow = {
  id: string; title: string; description: string | null; due_date: string; due_time: string | null; priority: string; status: string;
  assignee_id: string | null; is_auto: boolean; contact_id: string; deal_id: string | null;
  crm_contacts: { id: string; name: string } | null; crm_deals: { id: string; title: string } | null;
};

export function ReminderList({ rows, showContact, onChanged, onEdit }: { rows: ReminderRow[]; showContact?: boolean; onChanged: () => void; onEdit?: (r: ReminderRow) => void }) {
  const { org, can } = useOrg();
  const members = useCrmFilters().data?.members;
  const setStatus = useServerFn(setReminderStatus);
  const today = todayISO();
  const change = async (id: string, status: "pending" | "done" | "canceled") => {
    try { await setStatus({ data: { organizationId: org.id, reminderId: id, status } }); onChanged(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((r) => {
        const overdue = r.status === "pending" && r.due_date < today;
        return (
          <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
            <div className="min-w-0 space-y-1">
              <p className={`font-medium ${r.status !== "pending" ? "line-through text-muted-foreground" : ""}`}>{r.title}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className={overdue ? "font-medium text-destructive" : ""}>{brDate(r.due_date)}{r.due_time ? ` ${r.due_time.slice(0, 5)}` : ""}{overdue ? " · atrasado" : ""}</span>
                <Badge variant={r.priority === "high" ? "destructive" : "secondary"}>{PRIORITIES[r.priority as "low"]}</Badge>
                {r.status === "done" && <Badge variant="outline">Concluído</Badge>}
                {r.status === "canceled" && <Badge variant="outline">Cancelado</Badge>}
                {r.is_auto && <Badge variant="outline">Automático</Badge>}
                <span>· {memberName(members, r.assignee_id)}</span>
                {showContact && r.crm_contacts && <Link to="/app/crm/$contactId" params={{ contactId: r.contact_id }} className="text-primary hover:underline">{r.crm_contacts.name}</Link>}
                {r.crm_deals && <span>· {r.crm_deals.title}</span>}
              </div>
              {r.description && <p className="text-muted-foreground">{r.description}</p>}
            </div>
            {can("crm.update") && (
              <div className="flex gap-1">
                {r.status === "pending" ? (
                  <>
                    <Button size="sm" onClick={() => change(r.id, "done")}>Concluir</Button>
                    {onEdit && <Button size="sm" variant="ghost" onClick={() => onEdit(r)}>Editar</Button>}
                    <Button size="sm" variant="ghost" onClick={() => change(r.id, "canceled")}>Cancelar</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => change(r.id, "pending")}>Reabrir</Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
