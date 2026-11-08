import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOrg } from "@/modules/core/org-context";
import { listContacts } from "@/modules/crm/contacts.functions";
import { KINDS, RELATIONSHIPS } from "@/modules/crm/normalize";
import { ContactForm } from "@/modules/crm/components/contact-form";
import { brDate, memberName, StateMsg, useCrmFilters, useStages } from "@/modules/crm/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type S = {
  q?: string; kind?: "pf" | "pj"; relationship?: "lead" | "client" | "partner" | "other"; category?: string; source?: string;
  tagId?: string; stageId?: string; ownerId?: string; status?: "active" | "archived" | "all"; from?: string; to?: string;
  sort?: "name" | "created_at" | "updated_at"; dir?: "asc" | "desc"; page?: number; pageSize?: 10 | 25 | 50;
};
const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

export const Route = createFileRoute("/_authenticated/app/crm/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    q: str(s["q"]), kind: s["kind"] === "pf" || s["kind"] === "pj" ? s["kind"] : undefined,
    relationship: ["lead", "client", "partner", "other"].includes(s["relationship"] as string) ? (s["relationship"] as S["relationship"]) : undefined,
    category: str(s["category"]), source: str(s["source"]), tagId: str(s["tagId"]), stageId: str(s["stageId"]), ownerId: str(s["ownerId"]),
    status: ["active", "archived", "all"].includes(s["status"] as string) ? (s["status"] as S["status"]) : undefined,
    from: str(s["from"]), to: str(s["to"]),
    sort: ["name", "created_at", "updated_at"].includes(s["sort"] as string) ? (s["sort"] as S["sort"]) : undefined,
    dir: s["dir"] === "asc" || s["dir"] === "desc" ? s["dir"] : undefined,
    page: Number(s["page"]) > 0 ? Math.floor(Number(s["page"])) : undefined,
    pageSize: [10, 25, 50].includes(Number(s["pageSize"])) ? (Number(s["pageSize"]) as 10) : undefined,
  }),
  head: () => ({ meta: [{ title: "Clientes — Ateliê" }, { name: "description", content: "Contatos, leads e clientes da organização." }, { property: "og:title", content: "Clientes — Ateliê" }, { property: "og:description", content: "Contatos, leads e clientes da organização." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ContactsPage,
});

const ALL = "__all";

function ContactsPage() {
  const { org, can } = useOrg();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/crm/" });
  const qc = useQueryClient();
  const list = useServerFn(listContacts);
  const filters = useCrmFilters();
  const stages = useStages();
  const [q, setQ] = useState(search.q ?? "");
  const [creating, setCreating] = useState(false);
  const params = { ...search, page: search.page ?? 1, pageSize: search.pageSize ?? 25 };
  const data = useQuery({ queryKey: ["crm-contacts", org.id, params], queryFn: () => list({ data: { organizationId: org.id, ...params } }), enabled: can("crm.read") });
  const upd = (p: Partial<S>) => navigate({ search: (s) => ({ ...s, ...p, page: "page" in p ? p.page : undefined }) });

  if (!can("crm.read")) return <p className="text-muted-foreground">Você não tem acesso aos clientes desta organização.</p>;
  const pages = data.data ? Math.max(1, Math.ceil(data.data.total / params.pageSize)) : 1;

  const filterSel = (label: string, key: keyof S, opts: { value: string; label: string }[]) => (
    <Select value={(search[key] as string | undefined) ?? ALL} onValueChange={(v) => upd({ [key]: v === ALL ? undefined : v } as Partial<S>)}>
      <SelectTrigger className="w-40" aria-label={label}><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent><SelectItem value={ALL}>{label}: todos</SelectItem>{opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Clientes</h1>
          <p className="text-sm text-muted-foreground">Leads, clientes e parceiros em um só lugar.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("crm.update") && <Button asChild variant="outline"><Link to="/app/crm/duplicados">Duplicados</Link></Button>}
          {can("crm.create") && <Button onClick={() => setCreating(true)}>Novo contato</Button>}
        </div>
      </header>

      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); upd({ q: q || undefined, page: 1 }); }}>
        <Input className="min-w-56 flex-1" placeholder="Buscar por nome, telefone, WhatsApp, e-mail ou documento" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <Button type="submit" variant="secondary">Buscar</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {filterSel("Tipo", "kind", Object.entries(KINDS).map(([value, label]) => ({ value, label })))}
        {filterSel("Relação", "relationship", Object.entries(RELATIONSHIPS).map(([value, label]) => ({ value, label })))}
        {filterSel("Categoria", "category", (filters.data?.categories ?? []).map((c) => ({ value: c, label: c })))}
        {filterSel("Origem", "source", (filters.data?.sources ?? []).map((c) => ({ value: c, label: c })))}
        {filterSel("Etiqueta", "tagId", (filters.data?.tags ?? []).map((t) => ({ value: t.id, label: t.name })))}
        {filterSel("Etapa", "stageId", (stages.data ?? []).map((t) => ({ value: t.id, label: t.name })))}
        {filterSel("Responsável", "ownerId", (filters.data?.members ?? []).map((m) => ({ value: m.id, label: m.name })))}
        <Select value={search.status ?? "active"} onValueChange={(v) => upd({ status: v as S["status"] })}>
          <SelectTrigger className="w-36" aria-label="Situação"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="active">Ativos</SelectItem><SelectItem value="archived">Arquivados</SelectItem><SelectItem value="all">Todos</SelectItem></SelectContent>
        </Select>
        <Input type="date" className="w-40" aria-label="Cadastrados a partir de" value={search.from ?? ""} onChange={(e) => upd({ from: e.target.value || undefined })} />
        <Input type="date" className="w-40" aria-label="Cadastrados até" value={search.to ?? ""} onChange={(e) => upd({ to: e.target.value || undefined })} />
        <Select value={`${search.sort ?? "created_at"}:${search.dir ?? "desc"}`} onValueChange={(v) => { const [sort, dir] = v.split(":") as [S["sort"], S["dir"]]; upd({ sort, dir }); }}>
          <SelectTrigger className="w-48" aria-label="Ordenar"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name:asc">Nome (A–Z)</SelectItem><SelectItem value="name:desc">Nome (Z–A)</SelectItem>
            <SelectItem value="created_at:desc">Mais recentes</SelectItem><SelectItem value="created_at:asc">Mais antigos</SelectItem>
            <SelectItem value="updated_at:desc">Atualizados recentemente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <StateMsg loading={data.isLoading} error={data.error}
        empty={data.data?.total === 0 && (Object.values(search).some(Boolean) ? "Nenhum contato com esses filtros." : "Nenhum contato ainda. Clique em “Novo contato” para cadastrar o primeiro.")}>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Nome</th><th className="p-3">Contato</th><th className="p-3">Relação</th><th className="hidden p-3 md:table-cell">Responsável</th><th className="hidden p-3 md:table-cell">Cadastro</th></tr>
            </thead>
            <tbody className="divide-y">
              {data.data?.rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <td className="p-3">
                    <Link to="/app/crm/$contactId" params={{ contactId: c.id }} className="font-medium hover:underline">{c.name}</Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="text-xs text-muted-foreground">{KINDS[c.kind as "pf"]}</span>
                      {c.archived_at && <Badge variant="outline">Arquivado</Badge>}
                      {c.tags.map((t) => <Badge key={t.id} variant="secondary">{t.name}</Badge>)}
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.email ?? c.whatsapp ?? c.phone ?? "—"}</td>
                  <td className="p-3">{RELATIONSHIPS[c.relationship as "lead"]}</td>
                  <td className="hidden p-3 md:table-cell">{memberName(filters.data?.members, c.owner_id)}</td>
                  <td className="hidden p-3 md:table-cell">{brDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">{data.data?.total} contato(s) · página {params.page} de {pages}</span>
          <div className="flex items-center gap-2">
            <Select value={String(params.pageSize)} onValueChange={(v) => upd({ pageSize: Number(v) as 10, page: 1 })}>
              <SelectTrigger className="w-28" aria-label="Por página"><SelectValue /></SelectTrigger>
              <SelectContent>{[10, 25, 50].map((n) => <SelectItem key={n} value={String(n)}>{n} / página</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" disabled={params.page <= 1} onClick={() => upd({ page: params.page - 1 })}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={params.page >= pages} onClick={() => upd({ page: params.page + 1 })}>Próxima</Button>
          </div>
        </div>
      </StateMsg>

      {creating && (
        <ContactForm open onOpenChange={setCreating} onSaved={(id) => {
          setCreating(false);
          qc.invalidateQueries({ queryKey: ["crm-contacts", org.id] });
          qc.invalidateQueries({ queryKey: ["crm-filters", org.id] });
          navigate({ to: "/app/crm/$contactId", params: { contactId: id } });
        }} />
      )}
    </section>
  );
}
