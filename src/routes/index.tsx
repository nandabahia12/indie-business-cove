import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ateliê — gestão para profissionais autônomos" },
      { name: "description", content: "Clientes, propostas, agenda, produção e financeiro do seu negócio em um só lugar." },
      { property: "og:title", content: "Ateliê — gestão para profissionais autônomos" },
      { property: "og:description", content: "Clientes, propostas, agenda, produção e financeiro do seu negócio em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-xl text-center">
        <p className="font-display text-2xl text-primary">Ateliê</p>
        <h1 className="mt-6 text-5xl leading-tight text-foreground">O seu negócio, organizado do primeiro contato à entrega.</h1>
        <p className="mt-4 text-muted-foreground">Clientes, propostas, agenda, produção e financeiro em um só lugar.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Entrar</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/app">Abrir painel</Link></Button>
        </div>
      </div>
    </main>
  );
}
