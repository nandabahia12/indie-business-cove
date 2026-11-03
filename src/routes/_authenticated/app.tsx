import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listMyOrganizations } from "@/modules/core/organizations.functions";
import { getOrgContext } from "@/modules/core/members.functions";
import { OrgContext } from "@/modules/core/org-context";
import { getStoredOrgId, storeOrgId } from "@/lib/active-org";
import { roleLabel } from "@/modules/core/roles";
import { CreateOrganization } from "@/modules/core/components/create-organization";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Painel — Ateliê" },
      { name: "description", content: "Painel da sua organização." },
      { property: "og:title", content: "Painel — Ateliê" },
      { property: "og:description", content: "Painel da sua organização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

function AppLayout() {
  const listOrgs = useServerFn(listMyOrganizations);
  const loadCtx = useServerFn(getOrgContext);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const orgs = useQuery({ queryKey: ["my-orgs"], queryFn: () => listOrgs() });
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!orgs.data) return;
    const stored = getStoredOrgId();
    const valid = orgs.data.find((o) => o.id === stored) ?? orgs.data[0];
    setActiveId(valid?.id ?? null);
    storeOrgId(valid?.id ?? null);
  }, [orgs.data]);

  const ctx = useQuery({
    queryKey: ["org-ctx", activeId],
    queryFn: () => loadCtx({ data: { organizationId: activeId! } }),
    enabled: Boolean(activeId),
  });

  const value = useMemo(() => {
    if (!ctx.data) return null;
    const perms = new Set(ctx.data.permissions);
    return {
      ...ctx.data,
      can: (p: string) => perms.has(p),
      isOwner: ctx.data.roles.includes("owner"),
      isAdmin: ctx.data.roles.some((r) => r === "owner" || r === "admin"),
    };
  }, [ctx.data]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    storeOrgId(null);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function switchOrg(id: string) {
    storeOrgId(id);
    setActiveId(id);
  }

  if (orgs.isLoading) return <p className="p-10 text-muted-foreground">Carregando…</p>;
  if (orgs.error) return <p className="p-10 text-destructive">Não foi possível carregar suas organizações.</p>;

  if (!orgs.data?.length) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md">
          <CreateOrganization onCreated={(id) => { storeOrgId(id); qc.invalidateQueries({ queryKey: ["my-orgs"] }); }} />
          <Button variant="ghost" className="mt-4 w-full" onClick={signOut}>Sair</Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link to="/app" className="font-display text-xl text-primary">Ateliê</Link>
          {orgs.data.length > 1 ? (
            <Select value={activeId ?? undefined} onValueChange={switchOrg}>
              <SelectTrigger className="w-56" aria-label="Organização ativa"><SelectValue /></SelectTrigger>
              <SelectContent>
                {orgs.data.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium">{orgs.data[0]?.name}</span>
          )}
          <nav className="flex gap-4 text-sm">
            <Link to="/app" activeOptions={{ exact: true }} className="text-muted-foreground [&.active]:text-foreground">Início</Link>
            {value?.can("core.read") && (
              <Link to="/app/members" className="text-muted-foreground [&.active]:text-foreground">Equipe</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {value && <span className="text-muted-foreground">{value.roles.map(roleLabel).join(", ")}</span>}
            <Button variant="outline" size="sm" onClick={signOut}>Sair</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        {ctx.error ? (
          <p className="text-destructive">Você não tem acesso a esta organização.</p>
        ) : value ? (
          <OrgContext.Provider value={value}><Outlet /></OrgContext.Provider>
        ) : (
          <p className="text-muted-foreground">Carregando…</p>
        )}
      </main>
    </div>
  );
}
