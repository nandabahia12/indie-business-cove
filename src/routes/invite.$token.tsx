import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/modules/core/members.functions";
import { storeOrgId } from "@/lib/active-org";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Convite — Ateliê" },
      { name: "description", content: "Aceite o convite para participar de uma organização." },
      { property: "og:title", content: "Convite — Ateliê" },
      { property: "og:description", content: "Aceite o convite para participar de uma organização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const accept = useServerFn(acceptInvitation);
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  async function onAccept() {
    setBusy(true);
    setError(null);
    try {
      const { organizationId } = await accept({ data: { token } });
      storeOrgId(organizationId);
      navigate({ to: "/app", replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Convite inválido.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <h1 className="text-3xl">Você recebeu um convite</h1>
        {signedIn === false && (
          <>
            <p className="mt-4 text-sm text-muted-foreground">Entre ou crie sua conta com o e-mail que recebeu o convite.</p>
            <Button asChild className="mt-6 w-full">
              <Link to="/auth" search={{ redirect: `/invite/${token}` }}>Entrar para aceitar</Link>
            </Button>
          </>
        )}
        {signedIn && (
          <Button className="mt-6 w-full" onClick={onAccept} disabled={busy}>Aceitar convite</Button>
        )}
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </div>
    </main>
  );
}
