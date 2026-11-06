import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useOrg } from "@/modules/core/org-context";
import { getDashboard } from "@/modules/onboarding/onboarding.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

type Flow = { key: string; name: string; steps: string[] };
type Pkg = { name: string; hours: number; price_cents: number; plus_travel_fee?: boolean };

function Home() {
  const { org, isAdmin } = useOrg();
  const load = useServerFn(getDashboard);
  const q = useQuery({ queryKey: ["dashboard", org.id], queryFn: () => load({ data: { organizationId: org.id } }) });

  if (q.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (q.error || !q.data) return <p className="text-destructive">Não foi possível carregar o painel.</p>;
  const { modules, settings, onboardingStatus } = q.data;
  const flows = (settings["flows"] as Flow[] | undefined) ?? [];
  const pkgs = (settings["service_packages"] as Pkg[] | undefined) ?? [];
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <section className="space-y-10">
      <header>
        <h1 className="text-4xl">{org.name}</h1>
        {typeof settings["timezone"] === "string" && <p className="mt-1 text-sm text-muted-foreground">Fuso: {settings["timezone"] as string} · Moeda: BRL</p>}
      </header>

      {onboardingStatus !== "completed" && isAdmin && (
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-xl">Vamos configurar seu ambiente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Responda algumas perguntas e receba sugestões de módulos.</p>
          <Button asChild className="mt-4"><Link to="/app/onboarding">Começar</Link></Button>
        </div>
      )}

      <div>
        <h2 className="text-xl">Seus módulos</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <li key={m.key} className="rounded-lg border bg-card p-4">
              <p className="font-medium">{m.name}</p>
              <p className="text-sm text-muted-foreground">{m.description}</p>
              {m.key !== "core" && <p className="mt-2 text-xs text-muted-foreground">Telas em construção nas próximas etapas.</p>}
            </li>
          ))}
        </ul>
      </div>

      {flows.length > 0 && (
        <div>
          <h2 className="text-xl">Seus fluxos</h2>
          {flows.map((f) => (
            <p key={f.key} className="mt-2 text-sm"><span className="font-medium">{f.name}:</span> {f.steps.join(" → ")}</p>
          ))}
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
