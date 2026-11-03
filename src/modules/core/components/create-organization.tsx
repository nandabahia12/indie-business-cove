import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { createOrganization } from "@/modules/core/organizations.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function slugify(v: string) {
  return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export function CreateOrganization({ onCreated }: { onCreated: (id: string) => void }) {
  const create = useServerFn(createOrganization);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") ?? "").trim();
    const segment = String(f.get("segment") ?? "").trim();
    const slug = `${slugify(name) || "org"}-${crypto.randomUUID().slice(0, 6)}`;
    setBusy(true);
    try {
      const { id } = await create({ data: { name, slug, ...(segment ? { segment } : {}) } });
      onCreated(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card p-8 shadow-sm">
      <h1 className="text-3xl">Crie sua organização</h1>
      <p className="text-sm text-muted-foreground">É o espaço do seu negócio. Você poderá convidar sua equipe depois.</p>
      <div className="space-y-1.5">
        <Label htmlFor="org-name">Nome do negócio</Label>
        <Input id="org-name" name="name" required maxLength={120} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-segment">Segmento (opcional)</Label>
        <Input id="org-segment" name="segment" maxLength={60} placeholder="Ex.: fotografia, eventos" />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>Criar organização</Button>
    </form>
  );
}
