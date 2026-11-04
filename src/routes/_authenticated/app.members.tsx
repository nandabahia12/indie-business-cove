import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { inviteMember, listMembers, removeMember, revokeInvitation, setMemberRole } from "@/modules/core/members.functions";
import { ASSIGNABLE_ROLES, roleLabel } from "@/modules/core/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/members")({
  component: Members,
});

function Members() {
  const { org, isAdmin, isOwner } = useOrg();
  const qc = useQueryClient();
  const list = useServerFn(listMembers);
  const invite = useServerFn(inviteMember);
  const revoke = useServerFn(revokeInvitation);
  const setRole = useServerFn(setMemberRole);
  const remove = useServerFn(removeMember);
  const key = ["members", org.id];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { organizationId: org.id } }) });
  const [role, setInviteRole] = useState("collaborator");
  const [link, setLink] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  const onErr = (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro");

  const inviteMut = useMutation({
    mutationFn: (email: string) => invite({ data: { organizationId: org.id, email, role } }),
    onSuccess: ({ token }) => { setLink(`${window.location.origin}/invite/${token}`); refresh(); },
    onError: onErr,
  });
  const allowedRoles = ASSIGNABLE_ROLES.filter((r) => isOwner || (r !== "owner" && r !== "admin"));

  function onInvite(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    inviteMut.mutate(String(new FormData(e.currentTarget).get("email") ?? ""));
    e.currentTarget.reset();
  }

  return (
    <section className="space-y-10">
      <h1 className="text-4xl">Equipe</h1>

      {isAdmin && (
        <form onSubmit={onInvite} className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-6">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="invite-email">Convidar por e-mail</Label>
            <Input id="invite-email" name="email" type="email" required />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={role} onValueChange={setInviteRole}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{allowedRoles.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={inviteMut.isPending}>Gerar convite</Button>
          {link && (
            <div className="w-full rounded-md bg-muted p-3 text-sm">
              <p className="mb-2 text-muted-foreground">Envie este link para a pessoa convidada (válido por 7 dias, só funciona com o e-mail informado):</p>
              <div className="flex gap-2">
                <Input readOnly value={link} />
                <Button type="button" variant="outline" onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>Copiar</Button>
              </div>
            </div>
          )}
        </form>
      )}

      <div>
        <h2 className="mb-3 text-2xl">Membros</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {q.data?.members.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex-1">{m.name ?? "Sem nome"}</span>
              {isAdmin ? (
                <Select value={m.roles[0] ?? ""} onValueChange={(r) => void setRole({ data: { organizationId: org.id, userId: m.user_id, role: r } }).then(refresh, onErr)}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{ASSIGNABLE_ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground">{m.roles.map(roleLabel).join(", ")}</span>
              )}
              {isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => remove({ data: { organizationId: org.id, userId: m.user_id } }).then(refresh, onErr)}>Remover</Button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && !!q.data?.invitations.length && (
        <div>
          <h2 className="mb-3 text-2xl">Convites pendentes</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {q.data.invitations.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-4 text-sm">
                <span className="flex-1">{i.email}</span>
                <span className="text-muted-foreground">{roleLabel(i.role)}</span>
                <Button variant="ghost" size="sm" onClick={() => revoke({ data: { invitationId: i.id } }).then(refresh, onErr)}>Cancelar</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
