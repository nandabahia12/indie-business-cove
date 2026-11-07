import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { checkDuplicates, saveContact, type ContactInput } from "../contacts.functions";
import { CHANNEL_LABELS, CHANNEL_TYPES, isValidDoc, KINDS, RELATIONSHIPS } from "../normalize";
import { errMsg, useCrmFilters } from "./common";

type Channel = { type: "email" | "phone" | "whatsapp"; value: string; label: "personal" | "work" | "whatsapp" | "other"; is_primary: boolean };
type Form = Omit<ContactInput, "channels" | "tags"> & { channels: Channel[]; tags: string };
type Dup = { id: string; name: string; email: string | null; phone: string | null; archived: boolean; reason: string };

const EMPTY: Form = { kind: "pf", name: "", relationship: "lead", channels: [], tags: "" };

export function ContactForm({ open, onOpenChange, contactId, initial, onSaved }: {
  open: boolean; onOpenChange: (v: boolean) => void; contactId?: string; initial?: Partial<Form>; onSaved: (id: string) => void;
}) {
  const { org } = useOrg();
  const filters = useCrmFilters();
  const save = useServerFn(saveContact);
  const dupCheck = useServerFn(checkDuplicates);
  const [f, setF] = useState<Form>({ ...EMPTY, ...initial });
  const [dups, setDups] = useState<Dup[] | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const s = (k: keyof Form) => (f[k] as string | null | undefined) ?? "";

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Informe o nome.");
    if (f.doc && !isValidDoc(f.doc)) return toast.error("CPF/CNPJ inválido.");
    setBusy(true);
    try {
      if (!force) {
        const found = await dupCheck({ data: {
          organizationId: org.id, email: f.email ?? null, phone: f.phone ?? null, whatsapp: f.whatsapp ?? null, doc: f.doc ?? null,
          extra: f.channels.map((c) => c.value).filter(Boolean), ...(contactId ? { excludeId: contactId } : {}),
        } });
        if (found.length) { setDups(found); return; }
      }
      const tags = f.tags.split(",").map((t) => t.trim()).filter(Boolean);
      const { id } = await save({ data: { organizationId: org.id, ...(contactId ? { contactId } : {}), contact: { ...f, tags, channels: f.channels.filter((c) => c.value.trim()) } } });
      toast.success(contactId ? "Contato atualizado." : "Contato cadastrado.");
      setDups(null);
      onSaved(id);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{contactId ? "Editar contato" : "Novo contato"}</DialogTitle></DialogHeader>
        {dups ? (
          <div className="space-y-4">
            <p className="text-sm">Encontramos {dups.length === 1 ? "um contato parecido" : "contatos parecidos"}:</p>
            <ul className="divide-y rounded-md border">
              {dups.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-medium">{d.name} {d.archived && <span className="text-xs text-muted-foreground">(arquivado)</span>}</p>
                    <p className="text-xs text-muted-foreground">Mesmo {d.reason} · {d.email ?? d.phone ?? ""}</p>
                  </div>
                  <Button asChild size="sm" variant="outline"><Link to="/app/crm/$contactId" params={{ contactId: d.id }} onClick={() => onOpenChange(false)}>Abrir existente</Link></Button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDups(null)}>Voltar</Button>
              <Button disabled={busy} onClick={(e) => submit(e, true)}>Salvar mesmo assim</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => submit(e)} className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de cadastro">
                <Select value={f.kind} onValueChange={(v) => set("kind", v as "pf" | "pj")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(KINDS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Relacionamento">
                <Select value={f.relationship} onValueChange={(v) => set("relationship", v as Form["relationship"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RELATIONSHIPS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={f.kind === "pj" ? "Razão social *" : "Nome completo *"}><Input value={f.name} onChange={(e) => set("name", e.target.value)} required maxLength={200} /></Field>
              {f.kind === "pj" && <Field label="Nome fantasia"><Input value={s("trade_name")} onChange={(e) => set("trade_name", e.target.value)} /></Field>}
              <Field label={f.kind === "pj" ? "CNPJ" : "CPF"}><Input value={s("doc")} onChange={(e) => set("doc", e.target.value)} inputMode="numeric" placeholder="Opcional" /></Field>
              <Field label="E-mail principal"><Input type="email" value={s("email")} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Telefone principal"><Input value={s("phone")} onChange={(e) => set("phone", e.target.value)} inputMode="tel" /></Field>
              <Field label="WhatsApp"><Input value={s("whatsapp")} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" /></Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Outros telefones e e-mails</Label>
                <Button type="button" size="sm" variant="ghost" onClick={() => set("channels", [...f.channels, { type: "phone", value: "", label: "other", is_primary: false }])}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>
              </div>
              {f.channels.map((c, i) => {
                const upd = (p: Partial<Channel>) => set("channels", f.channels.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Select value={c.type} onValueChange={(v) => upd({ type: v as Channel["type"] })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(CHANNEL_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input className="min-w-40 flex-1" value={c.value} onChange={(e) => upd({ value: e.target.value })} aria-label="Valor" />
                    <Select value={c.label} onValueChange={(v) => upd({ label: v as Channel["label"] })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(CHANNEL_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={c.is_primary} onChange={(e) => upd({ is_primary: e.target.checked })} />Principal</label>
                    <Button type="button" size="icon" variant="ghost" aria-label="Remover" onClick={() => set("channels", f.channels.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>

            {f.kind === "pj" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Responsável na empresa"><Input value={s("pj_contact_name")} onChange={(e) => set("pj_contact_name", e.target.value)} /></Field>
                <Field label="Cargo"><Input value={s("pj_contact_role")} onChange={(e) => set("pj_contact_role", e.target.value)} /></Field>
                <Field label="E-mail do responsável"><Input value={s("pj_contact_email")} onChange={(e) => set("pj_contact_email", e.target.value)} /></Field>
                <Field label="Telefone do responsável"><Input value={s("pj_contact_phone")} onChange={(e) => set("pj_contact_phone", e.target.value)} /></Field>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Rua"><Input value={s("address_street")} onChange={(e) => set("address_street", e.target.value)} /></Field>
              <Field label="Número"><Input value={s("address_number")} onChange={(e) => set("address_number", e.target.value)} /></Field>
              <Field label="Complemento"><Input value={s("address_complement")} onChange={(e) => set("address_complement", e.target.value)} /></Field>
              <Field label="Bairro"><Input value={s("address_district")} onChange={(e) => set("address_district", e.target.value)} /></Field>
              <Field label="Cidade"><Input value={s("address_city")} onChange={(e) => set("address_city", e.target.value)} /></Field>
              <Field label="UF"><Input value={s("address_state")} maxLength={2} onChange={(e) => set("address_state", e.target.value.toUpperCase())} /></Field>
              <Field label="CEP"><Input value={s("address_zip")} onChange={(e) => set("address_zip", e.target.value)} /></Field>
              <Field label="Origem"><Input value={s("source")} list="crm-sources" placeholder="Instagram, indicação…" onChange={(e) => set("source", e.target.value)} /></Field>
              <Field label="Categoria"><Input value={s("category")} list="crm-categories" onChange={(e) => set("category", e.target.value)} /></Field>
            </div>
            <datalist id="crm-sources">{filters.data?.sources.map((x) => <option key={x} value={x} />)}</datalist>
            <datalist id="crm-categories">{filters.data?.categories.map((x) => <option key={x} value={x} />)}</datalist>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Responsável pelo relacionamento">
                <Select value={f.owner_id ?? "none"} onValueChange={(v) => set("owner_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Eu" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{contactId ? "Sem responsável" : "Eu"}</SelectItem>
                    {filters.data?.members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Etiquetas (separe por vírgula)"><Input value={f.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
            </div>
            <Field label="Preferências"><Textarea rows={2} value={s("preferences")} onChange={(e) => set("preferences", e.target.value)} /></Field>
            <Field label="Observações"><Textarea rows={3} value={s("notes")} onChange={(e) => set("notes", e.target.value)} /></Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? "Salvando…" : "Salvar"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
