import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/modules/core/org-context";
import { orgFilePath, ORG_FILES_BUCKET } from "@/lib/storage";
import { deleteContact, getContact, setContactArchived, transferContactOwner } from "@/modules/crm/contacts.functions";
import { listDeals } from "@/modules/crm/pipeline.functions";
import { addInteraction, deleteContactFile, getFileUrl, listContactFiles, listInteractions, listReminders, registerContactFile } from "@/modules/crm/activity.functions";
import { brl, CHANNEL_LABELS, CHANNEL_TYPES, formatDoc, INTERACTION_KINDS, KINDS, RELATIONSHIPS } from "@/modules/crm/normalize";
import { ContactForm } from "@/modules/crm/components/contact-form";
import { DealForm, type DealFormValue } from "@/modules/crm/components/deal-form";
import { ReminderForm, type ReminderFormValue } from "@/modules/crm/components/reminder-form";
import { ReminderList, type ReminderRow } from "@/modules/crm/components/reminder-list";
import { brDate, brDateTime, errMsg, memberName, StateMsg, todayISO, useCrmFilters, useStages } from "@/modules/crm/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/app/crm/$contactId")({
  head: () => ({ meta: [{ title: "Contato — Ateliê" }, { name: "description", content: "Ficha do contato." }, { property: "og:title", content: "Contato — Ateliê" }, { property: "og:description", content: "Ficha do contato." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ContactPage,
});

function ContactPage() {
  const { contactId } = Route.useParams();
  const { org, can } = useOrg();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const members = useCrmFilters().data?.members;
  const stages = useStages(true);
  const getFn = useServerFn(getContact);
  const dealsFn = useServerFn(listDeals);
  const interFn = useServerFn(listInteractions);
  const remFn = useServerFn(listReminders);
  const filesFn = useServerFn(listContactFiles);
  const archiveFn = useServerFn(setContactArchived);
  const transferFn = useServerFn(transferContactOwner);
  const delFn = useServerFn(deleteContact);
  const addInter = useServerFn(addInteraction);
  const regFile = useServerFn(registerContactFile);
  const urlFn = useServerFn(getFileUrl);
  const delFile = useServerFn(deleteContactFile);
  const base = { organizationId: org.id, contactId };
  const c = useQuery({ queryKey: ["crm-contact", org.id, contactId], queryFn: () => getFn({ data: base }) });
  const deals = useQuery({ queryKey: ["crm-deals", org.id, contactId], queryFn: () => dealsFn({ data: base }) });
  const inter = useQuery({ queryKey: ["crm-inter", org.id, contactId], queryFn: () => interFn({ data: base }) });
  const rems = useQuery({ queryKey: ["crm-rem", org.id, contactId], queryFn: () => remFn({ data: { ...base, view: "all", today: todayISO() } }) });
  const files = useQuery({ queryKey: ["crm-files", org.id, contactId], queryFn: () => filesFn({ data: base }) });
  const [editing, setEditing] = useState(false);
  const [deal, setDeal] = useState<DealFormValue | null>(null);
  const [rem, setRem] = useState<ReminderFormValue | null>(null);
  const [kind, setKind] = useState<keyof typeof INTERACTION_KINDS>("note");
  const [body, setBody] = useState("");
  const [uploading, setUploading] = useState(false);
  const refresh = () => ["crm-contact", "crm-deals", "crm-inter", "crm-rem", "crm-files", "crm-contacts", "dashboard-data"].forEach((k) => qc.invalidateQueries({ queryKey: [k, org.id] }));

  if (c.isLoading || c.error || !c.data) return <StateMsg loading={c.isLoading} error={c.error ?? (!c.data && "Contato não encontrado.")} />;
  const { contact: k, channels, tags, doc } = c.data;
  const stageName = (id: string) => stages.data?.find((s) => s.id === id)?.name ?? "—";
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast.success(ok); refresh(); } catch (e) { toast.error(errMsg(e)); } };

  async function onInteraction(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await act(() => addInter({ data: { ...base, kind, body } }), "Interação registrada.");
    setBody("");
  }
  async function onUpload(file: File) {
    if (file.size > 50 * 1024 * 1024) return toast.error("Arquivo maior que 50 MB.");
    setUploading(true);
    try {
      const path = orgFilePath(org.id, `crm/${contactId}`, file.name);
      const up = await supabase.storage.from(ORG_FILES_BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw new Error("Não foi possível enviar o arquivo.");
      await regFile({ data: { ...base, path, name: file.name, mimeType: file.type || null, sizeBytes: file.size } });
      toast.success("Documento anexado."); refresh();
    } catch (e) { toast.error(errMsg(e)); } finally { setUploading(false); }
  }

  return (
    <section className="space-y-6">
      <Link to="/app/crm" className="text-sm text-muted-foreground hover:underline">← Clientes</Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl">{k.name}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{KINDS[k.kind as "pf"]}</Badge>
            <Badge>{RELATIONSHIPS[k.relationship as "lead"]}</Badge>
            {k.archived_at && <Badge variant="outline">Arquivado</Badge>}
            {k.merged_into_id && <Link to="/app/crm/$contactId" params={{ contactId: k.merged_into_id }}><Badge variant="outline">Unificado em outro contato →</Badge></Link>}
            {tags.map((t) => <Badge key={t.id} variant="outline">{t.name}</Badge>)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("crm.update") && !k.merged_into_id && <Button variant="outline" onClick={() => setEditing(true)}>Editar</Button>}
          {can("crm.update") && !k.merged_into_id && (
            <Button variant="outline" onClick={() => act(() => archiveFn({ data: { ...base, archived: !k.archived_at } }), k.archived_at ? "Contato reativado." : "Contato arquivado.")}>{k.archived_at ? "Reativar" : "Arquivar"}</Button>
          )}
          {can("crm.manage") && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="ghost" className="text-destructive">Excluir</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>Excluir definitivamente?</AlertDialogTitle>
                  <AlertDialogDescription>O contato, seu histórico e lembretes serão apagados. Não é possível excluir contatos com oportunidades; nesse caso, arquive. Esta ação fica registrada.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => { try { await delFn({ data: base }); toast.success("Contato excluído."); qc.invalidateQueries({ queryKey: ["crm-contacts", org.id] }); navigate({ to: "/app/crm" }); } catch (e) { toast.error(errMsg(e)); } }}>Excluir</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </header>

      <Tabs defaultValue="dados">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="oportunidades">Oportunidades ({deals.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="lembretes">Lembretes</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <dl className="grid gap-4 rounded-xl border bg-card p-6 text-sm sm:grid-cols-2">
            <Info label="E-mail" v={k.email} /><Info label="Telefone" v={k.phone} /><Info label="WhatsApp" v={k.whatsapp} />
            {can("crm.update") && <Info label={k.kind === "pj" ? "CNPJ" : "CPF"} v={doc ? formatDoc(doc) : null} />}
            {k.trade_name && <Info label="Nome fantasia" v={k.trade_name} />}
            <Info label="Origem" v={k.source} /><Info label="Categoria" v={k.category} />
            <Info label="Endereço" v={[k.address_street, k.address_number, k.address_complement, k.address_district, k.address_city, k.address_state, k.address_zip].filter(Boolean).join(", ") || null} />
            {k.kind === "pj" && <Info label="Responsável na empresa" v={[k.pj_contact_name, k.pj_contact_role, k.pj_contact_email, k.pj_contact_phone].filter(Boolean).join(" · ") || null} />}
            <div>
              <dt className="text-xs text-muted-foreground">Responsável pelo relacionamento</dt>
              {can("crm.update") ? (
                <Select value={k.owner_id ?? ""} onValueChange={(v) => act(() => transferFn({ data: { ...base, ownerId: v } }), "Responsabilidade transferida.")}>
                  <SelectTrigger className="mt-1 w-56"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent>{members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              ) : <dd>{memberName(members, k.owner_id)}</dd>}
            </div>
            <Info label="Cadastrado em" v={`${brDateTime(k.created_at)} por ${memberName(members, k.created_by)}`} />
            <Info label="Última atualização" v={brDateTime(k.updated_at)} />
            {channels.length > 0 && (
              <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Outros canais</dt>
                <ul className="mt-1 space-y-1">{channels.map((ch) => <li key={ch.id}>{CHANNEL_TYPES[ch.type as "email"]} ({CHANNEL_LABELS[ch.label as "other"]}): {ch.value} {ch.is_primary && <Badge variant="secondary">Principal</Badge>}</li>)}</ul></div>
            )}
            <Info label="Preferências" v={k.preferences} /><Info label="Observações" v={k.notes} />
          </dl>
        </TabsContent>

        <TabsContent value="oportunidades" className="mt-4 space-y-3">
          {can("crm.create") && !k.merged_into_id && <Button onClick={() => setDeal({ contact_id: contactId })}>Nova oportunidade</Button>}
          <StateMsg loading={deals.isLoading} error={deals.error} empty={deals.data?.length === 0 && "Nenhuma oportunidade para este contato."}>
            <ul className="divide-y rounded-xl border bg-card">
              {deals.data?.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div><p className="font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{stageName(d.stage_id)} · {brl(d.value_cents)} · {memberName(members, d.owner_id)} · previsão {brDate(d.expected_close_date)}{d.won_at ? ` · contratado em ${brDateTime(d.won_at)}` : ""}{d.lost_reason ? ` · motivo: ${d.lost_reason}` : ""}</p></div>
                  {can("crm.update") && <Button size="sm" variant="outline" onClick={() => setDeal({ ...d })}>Editar</Button>}
                </li>
              ))}
            </ul>
          </StateMsg>
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-4">
          {(can("crm.create") || can("crm.update")) && (
            <form onSubmit={onInteraction} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap gap-2">
                <Select value={kind} onValueChange={(v) => setKind(v as "note")}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(INTERACTION_KINDS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
              <Textarea rows={2} placeholder="O que aconteceu?" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} />
              <Button type="submit" size="sm" disabled={!body.trim()}>Registrar</Button>
            </form>
          )}
          <StateMsg loading={inter.isLoading} error={inter.error} empty={inter.data?.length === 0 && "Sem histórico ainda."}>
            <ol className="space-y-3 border-l pl-4">
              {inter.data?.map((i) => (
                <li key={i.id} className="text-sm">
                  <p className="text-xs text-muted-foreground">{brDateTime(i.occurred_at)} · {i.kind === "system" ? "Sistema" : INTERACTION_KINDS[i.kind as "note"]} · {memberName(members, i.author_id)}</p>
                  <p className="whitespace-pre-wrap">{i.body}</p>
                </li>
              ))}
            </ol>
          </StateMsg>
        </TabsContent>

        <TabsContent value="lembretes" className="mt-4 space-y-3">
          {(can("crm.create") || can("crm.update")) && <Button onClick={() => setRem({ contact_id: contactId })}>Novo lembrete</Button>}
          <StateMsg loading={rems.isLoading} error={rems.error} empty={rems.data?.length === 0 && "Nenhum lembrete para este contato."}>
            <ReminderList rows={(rems.data ?? []) as ReminderRow[]} onChanged={refresh} onEdit={(r) => setRem({ ...r })} />
          </StateMsg>
        </TabsContent>

        <TabsContent value="documentos" className="mt-4 space-y-3">
          {can("crm.update") && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
              {uploading ? "Enviando…" : "Anexar documento"}
              <input type="file" className="sr-only" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
            </label>
          )}
          <StateMsg loading={files.isLoading} error={files.error} empty={files.data?.length === 0 && "Nenhum documento anexado. Os arquivos ficam em área privada da organização."}>
            <ul className="divide-y rounded-xl border bg-card">
              {files.data?.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                  <button className="truncate text-left hover:underline" onClick={async () => { try { const { url } = await urlFn({ data: { organizationId: org.id, fileId: f.id } }); window.open(url, "_blank", "noopener"); } catch (e) { toast.error(errMsg(e)); } }}>{f.name}</button>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">{brDate(f.created_at)}
                    {can("crm.delete") && <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este documento?")) act(() => delFile({ data: { organizationId: org.id, fileId: f.id } }), "Documento removido."); }}>Remover</Button>}
                  </span>
                </li>
              ))}
            </ul>
          </StateMsg>
        </TabsContent>
      </Tabs>

      {editing && (
        <ContactForm open onOpenChange={setEditing} contactId={contactId}
          initial={{ ...k, doc, tags: tags.map((t) => t.name).join(", "), channels: channels as never }}
          onSaved={() => { setEditing(false); refresh(); }} />
      )}
      {deal && <DealForm open onOpenChange={(v) => !v && setDeal(null)} initial={deal} onSaved={() => { setDeal(null); refresh(); }} />}
      {rem && <ReminderForm open onOpenChange={(v) => !v && setRem(null)} initial={rem} deals={deals.data?.map((d) => ({ id: d.id, title: d.title }))} onSaved={() => { setRem(null); refresh(); }} />}
    </section>
  );
}

function Info({ label, v }: { label: string; v: string | null | undefined }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap">{v || "—"}</dd></div>;
}
