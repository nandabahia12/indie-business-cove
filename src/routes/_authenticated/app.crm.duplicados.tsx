import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { dismissDuplicate, listDuplicatePairs, mergeContacts } from "@/modules/crm/duplicates.functions";
import { brDate, errMsg, StateMsg } from "@/modules/crm/components/common";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/crm/duplicados")({
  head: () => ({ meta: [{ title: "Duplicados — Ateliê" }, { name: "description", content: "Revisão de contatos possivelmente duplicados." }, { property: "og:title", content: "Duplicados — Ateliê" }, { property: "og:description", content: "Revisão de contatos possivelmente duplicados." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: DuplicatesPage,
});

function DuplicatesPage() {
  const { org, can } = useOrg();
  const qc = useQueryClient();
  const list = useServerFn(listDuplicatePairs);
  const merge = useServerFn(mergeContacts);
  const dismiss = useServerFn(dismissDuplicate);
  const q = useQuery({ queryKey: ["crm-dups", org.id], queryFn: () => list({ data: { organizationId: org.id } }), enabled: can("crm.update") });
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); qc.invalidateQueries({ queryKey: ["crm-dups", org.id] }); qc.invalidateQueries({ queryKey: ["crm-contacts", org.id] }); } catch (e) { toast.error(errMsg(e)); } };
  if (!can("crm.update")) return <p className="text-muted-foreground">Sem acesso.</p>;
  return (
    <section className="space-y-6">
      <Link to="/app/crm" className="text-sm text-muted-foreground hover:underline">← Clientes</Link>
      <div><h1 className="text-4xl">Possíveis duplicados</h1><p className="text-sm text-muted-foreground">Contatos com mesmo e-mail, telefone/WhatsApp ou CPF/CNPJ. Ao juntar, oportunidades, histórico, lembretes, etiquetas e documentos vão para o contato mantido.</p></div>
      <StateMsg loading={q.isLoading} error={q.error} empty={q.data?.length === 0 && "Nenhum possível duplicado encontrado."}>
        <ul className="space-y-4">
          {q.data?.map((p) => (
            <li key={`${p.a!.id}-${p.b!.id}`} className="rounded-xl border bg-card p-4 text-sm">
              <p className="mb-3 text-xs text-muted-foreground">Mesmo {p.reason}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[p.a!, p.b!].map((c, i) => {
                  const other = i === 0 ? p.b! : p.a!;
                  return (
                    <div key={c.id} className="space-y-1 rounded-md bg-secondary p-3">
                      <Link to="/app/crm/$contactId" params={{ contactId: c.id }} className="font-medium hover:underline">{c.name}</Link>
                      <p className="text-xs text-muted-foreground">{c.email ?? "—"} · {c.phone ?? c.whatsapp ?? "—"} · desde {brDate(c.created_at)}</p>
                      {can("crm.delete") && <Button size="sm" onClick={() => { if (confirm(`Manter "${c.name}" e juntar "${other.name}" a ele?`)) run(() => merge({ data: { organizationId: org.id, keepId: c.id, dropId: other.id } }), "Contatos unificados."); }}>Manter este e juntar</Button>}
                    </div>
                  );
                })}
              </div>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => run(() => dismiss({ data: { organizationId: org.id, a: p.a!.id, b: p.b!.id } }), "Marcados como pessoas diferentes.")}>São pessoas diferentes</Button>
            </li>
          ))}
        </ul>
      </StateMsg>
    </section>
  );
}
