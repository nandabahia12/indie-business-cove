import { createFileRoute } from "@tanstack/react-router";
import { useOrg } from "@/modules/core/org-context";

export const Route = createFileRoute("/_authenticated/app/")({
  component: Home,
});

function Home() {
  const { org } = useOrg();
  return (
    <section>
      <h1 className="text-4xl">{org.name}</h1>
      <p className="mt-2 text-muted-foreground">Os módulos do seu negócio aparecerão aqui nas próximas etapas.</p>
    </section>
  );
}
