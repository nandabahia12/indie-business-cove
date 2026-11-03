import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeRedirect } from "@/lib/safe-redirect";

const search = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => search.parse(s),
  head: () => ({
    meta: [
      { title: "Entrar — Ateliê" },
      { name: "description", content: "Acesse sua conta para gerenciar clientes, agenda e projetos." },
      { property: "og:title", content: "Entrar — Ateliê" },
      { property: "og:description", content: "Acesse sua conta para gerenciar clientes, agenda e projetos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { redirect } = Route.useSearch();
  const target = safeRedirect(redirect);
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message.includes("confirm") ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos.");
        navigate({ to: target, replace: true });
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres.");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${target}`,
            data: { full_name: String(f.get("name") ?? "").trim() },
          },
        });
        if (error) throw new Error("Não foi possível criar a conta. Verifique os dados.");
        setSent("Enviamos um link de confirmação para o seu e-mail. Confirme para entrar.");
      } else {
        await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        setSent("Se este e-mail tiver conta, você receberá um link para criar uma nova senha.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    sessionStorage.setItem("post-auth-redirect", target);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Não foi possível entrar com Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: target, replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-display text-2xl text-primary">Ateliê</p>
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <h1 className="text-3xl text-foreground">
            {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
          </h1>
          {sent ? (
            <p className="mt-6 text-sm text-muted-foreground">{sent}</p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" required maxLength={120} autoComplete="name" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" required minLength={mode === "signup" ? 8 : 1}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {mode === "signin" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
              </Button>
              {mode !== "forgot" && (
                <Button type="button" variant="outline" className="w-full" onClick={google}>
                  Continuar com Google
                </Button>
              )}
            </form>
          )}
          <div className="mt-6 flex flex-col gap-1 text-sm">
            {mode !== "signin" && <button className="text-left text-primary hover:underline" onClick={() => { setMode("signin"); setSent(null); }}>Já tenho conta</button>}
            {mode !== "signup" && <button className="text-left text-primary hover:underline" onClick={() => { setMode("signup"); setSent(null); }}>Criar uma conta</button>}
            {mode === "signin" && <button className="text-left text-muted-foreground hover:underline" onClick={() => { setMode("forgot"); setSent(null); }}>Esqueci minha senha</button>}
          </div>
        </div>
      </div>
    </main>
  );
}
