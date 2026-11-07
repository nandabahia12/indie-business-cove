import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useOrg } from "@/modules/core/org-context";
import { getCrmFilters } from "../contacts.functions";
import { listStages } from "../pipeline.functions";

export function useCrmFilters() {
  const { org } = useOrg();
  const fn = useServerFn(getCrmFilters);
  return useQuery({ queryKey: ["crm-filters", org.id], queryFn: () => fn({ data: { organizationId: org.id } }) });
}

export function useStages(includeArchived = false) {
  const { org } = useOrg();
  const fn = useServerFn(listStages);
  return useQuery({ queryKey: ["crm-stages", org.id, includeArchived], queryFn: () => fn({ data: { organizationId: org.id, includeArchived } }) });
}

/** Data de hoje (YYYY-MM-DD) no fuso de referência. */
export function todayISO(tz = "America/Bahia") {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

export const brDate = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
export const brDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Bahia", dateStyle: "short", timeStyle: "short" }) : "—";

export function parseMoney(v: string): number | null {
  const s = v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}
export const moneyInput = (cents?: number | null) => (cents == null ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Não foi possível concluir a operação.";
}

export function StateMsg({ loading, error, empty, children }: { loading?: boolean; error?: unknown; empty?: string | false; children?: React.ReactNode }) {
  if (loading) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>;
  if (error) return <p className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{errMsg(error)}</p>;
  if (empty) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{empty}</p>;
  return <>{children}</>;
}

export function memberName(members: { id: string; name: string }[] | undefined, id?: string | null) {
  if (!id) return "—";
  return members?.find((m) => m.id === id)?.name ?? "Ex-membro";
}
