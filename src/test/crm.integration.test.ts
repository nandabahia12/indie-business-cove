/** CRM contra o banco real: isolamento, permissões, gatilhos de contratação, arquivamento de etapa, fusão e entrada de contatos. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/integrations/supabase/types";

const URL = process.env["SUPABASE_URL"];
const ANON = process.env["SUPABASE_PUBLISHABLE_KEY"];
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];
const enabled = Boolean(URL && ANON && SERVICE);
type DB = SupabaseClient<Database>;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const run = Math.random().toString(36).slice(2, 8);
const PASSWORD = `T3st-${crypto.randomUUID()}`;
let admin: DB;
const users: string[] = [];
const orgs: string[] = [];

async function makeUser(label: string) {
  const email = `crm-${label}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error;
  users.push(data.user.id);
  const db = createClient<Database>(URL!, ANON!, { auth: { ...opts.auth, storageKey: `crm-${label}` } });
  await db.auth.signInWithPassword({ email, password: PASSWORD });
  return { id: data.user.id, email, db };
}
async function makeOrg(db: DB, label: string) {
  const { data, error } = await db.rpc("create_organization", { _name: `CRM ${label}`, _slug: `crm-${label}-${run}` });
  if (error || !data) throw error;
  orgs.push(data);
  await db.from("organization_modules").upsert({ organization_id: data, module_key: "crm", enabled: true });
  return data;
}

describe.skipIf(!enabled)("CRM", { timeout: 60_000 }, () => {
  let A: Awaited<ReturnType<typeof makeUser>>, B: typeof A, F: typeof A;
  let orgA = "", orgB = "";
  beforeAll(async () => {
    admin = createClient<Database>(URL!, SERVICE!, opts);
    [A, B, F] = (await Promise.all(["a", "b", "f"].map(makeUser))) as [typeof A, typeof A, typeof A];
    orgA = await makeOrg(A.db, "a");
    orgB = await makeOrg(B.db, "b");
    const { data: token } = await A.db.rpc("create_invitation", { _org: orgA, _email: F.email, _role: "freelancer" });
    await F.db.rpc("accept_invitation", { _token: token! });
  });
  afterAll(async () => {
    if (!enabled) return;
    for (const o of orgs) {
      await admin.from("crm_deals").delete().eq("organization_id", o);
      await admin.from("organizations").delete().eq("id", o);
    }
    for (const u of users) await admin.auth.admin.deleteUser(u);
  });

  it("cria as 9 etapas padrão ao ativar o CRM", async () => {
    const { data } = await A.db.from("crm_pipeline_stages").select("name, kind").eq("organization_id", orgA).order("position");
    expect(data?.map((s) => s.name)).toEqual(["Novo Lead", "Primeiro Contato", "Briefing / Reunião", "Proposta Enviada", "Em Negociação", "Aguardando Contrato", "Contratado", "Perdido", "Futuro / Nutrição"]);
    expect(data?.find((s) => s.name === "Contratado")?.kind).toBe("won");
    expect(data?.find((s) => s.name === "Perdido")?.kind).toBe("lost");
  });

  it("isola contatos entre organizações e bloqueia freelancer", async () => {
    const { data: c } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Cliente A", email: "x@a.com" }).select("id").single();
    expect((await B.db.from("crm_contacts").select("id").eq("id", c!.id)).data).toEqual([]);
    expect((await F.db.from("crm_contacts").select("id").eq("organization_id", orgA)).data).toEqual([]);
    expect((await B.db.from("crm_contacts").insert({ organization_id: orgA, name: "invasor" })).error).not.toBeNull();
    expect((await F.db.from("crm_contacts").insert({ organization_id: orgA, name: "free" })).error).not.toBeNull();
    // Interação de B apontando para contato de A é rejeitada.
    expect((await B.db.from("crm_interactions").insert({ organization_id: orgB, contact_id: c!.id, kind: "note", body: "x", author_id: B.id })).error).not.toBeNull();
    for (const t of ["crm_deals", "crm_reminders", "crm_interactions", "crm_contact_channels", "crm_pipeline_stages", "crm_tags"] as const) {
      const { data } = await B.db.from(t).select("organization_id").eq("organization_id", orgA);
      expect(data, t).toEqual([]);
    }
  });

  it("detecta duplicado por telefone com formatos diferentes", async () => {
    await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Maria", whatsapp: "+55 (71) 98888-7777" });
    const { data } = await A.db.rpc("crm_find_duplicates", { _org: orgA, _email: "", _phone: "71 988887777", _whatsapp: "", _doc: "" });
    expect(data?.map((d) => d.name)).toContain("Maria");
    const other = await B.db.rpc("crm_find_duplicates", { _org: orgA, _email: "", _phone: "71988887777", _whatsapp: "", _doc: "" });
    expect(other.error).not.toBeNull();
  });

  it("ao mover para Contratado registra conversão, histórico e cria lembrete", async () => {
    const { data: st } = await A.db.from("crm_pipeline_stages").select("id, kind, name").eq("organization_id", orgA);
    const open = st!.find((s) => s.name === "Novo Lead")!.id;
    const won = st!.find((s) => s.kind === "won")!.id;
    const { data: c } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Noiva" }).select("id").single();
    const { data: d } = await A.db.from("crm_deals").insert({ organization_id: orgA, contact_id: c!.id, stage_id: open, title: "Casamento" }).select("id").single();
    await A.db.from("crm_deals").update({ stage_id: won }).eq("id", d!.id);
    const deal = (await A.db.from("crm_deals").select("won_at, won_by").eq("id", d!.id).single()).data!;
    expect(deal.won_at).not.toBeNull();
    expect(deal.won_by).toBe(A.id);
    const rem = (await A.db.from("crm_reminders").select("deal_id, contact_id, is_auto").eq("deal_id", d!.id)).data!;
    expect(rem).toHaveLength(1);
    expect(rem[0]!.is_auto).toBe(true);
    const ev = (await A.db.from("crm_interactions").select("event").eq("contact_id", c!.id)).data!.map((e) => e.event);
    expect(ev).toEqual(expect.arrayContaining(["contact_created", "deal_created", "deal_won", "reminder_created"]));
  });

  it("arquivar etapa com oportunidades exige destino e transfere todas", async () => {
    const { data: st } = await A.db.from("crm_pipeline_stages").select("id, name").eq("organization_id", orgA);
    const from = st!.find((s) => s.name === "Primeiro Contato")!.id;
    const to = st!.find((s) => s.name === "Novo Lead")!.id;
    const { data: c } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Etapa" }).select("id").single();
    const { data: d } = await A.db.from("crm_deals").insert({ organization_id: orgA, contact_id: c!.id, stage_id: from, title: "T" }).select("id").single();
    expect((await A.db.rpc("crm_archive_stage", { _org: orgA, _stage: from } as never)).error).not.toBeNull();
    expect((await A.db.from("crm_pipeline_stages").delete().eq("id", from)).error).not.toBeNull();
    expect((await A.db.rpc("crm_archive_stage", { _org: orgA, _stage: from, _target: to })).error).toBeNull();
    expect((await A.db.from("crm_deals").select("stage_id").eq("id", d!.id).single()).data!.stage_id).toBe(to);
    // Não é possível colocar oportunidade em etapa arquivada.
    expect((await A.db.from("crm_deals").update({ stage_id: from }).eq("id", d!.id)).error).not.toBeNull();
  });

  it("junta contatos levando oportunidades e histórico", async () => {
    const { data: st } = await A.db.from("crm_pipeline_stages").select("id").eq("organization_id", orgA).is("archived_at", null).limit(1);
    const { data: k } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Pedro", email: "p@x.com" }).select("id").single();
    const { data: dr } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Pedro S.", email: "P@X.com", phone: "71 3333-4444" }).select("id").single();
    await A.db.from("crm_deals").insert({ organization_id: orgA, contact_id: dr!.id, stage_id: st![0]!.id, title: "Ensaio" });
    const pairs = (await A.db.rpc("crm_duplicate_pairs", { _org: orgA })).data!;
    expect(pairs.some((p) => [p.a, p.b].includes(k!.id) && [p.a, p.b].includes(dr!.id))).toBe(true);
    expect((await A.db.rpc("crm_merge_contacts", { _org: orgA, _keep: k!.id, _drop: dr!.id })).error).toBeNull();
    expect((await A.db.from("crm_deals").select("id").eq("contact_id", k!.id)).data).toHaveLength(1);
    expect((await A.db.from("crm_contacts").select("merged_into_id").eq("id", dr!.id).single()).data!.merged_into_id).toBe(k!.id);
    expect((await A.db.from("crm_contact_channels").select("norm").eq("contact_id", k!.id)).data!.map((c) => c.norm)).toContain("7133334444");
  });

  it("entrada de contatos valida, detecta existente e registra o resultado", async () => {
    const r0 = await A.db.rpc("crm_intake", { _org: orgA, _source: "formulário", _payload: { name: "" } });
    if (r0.error) throw new Error(r0.error.message);
    const bad = r0.data as { status: string };
    expect(bad.status).toBe("rejected");
    const n = (await A.db.rpc("crm_intake", { _org: orgA, _source: "formulário", _payload: { name: "Lead Novo", email: "novo@x.com" } })).data as { status: string };
    expect(n.status).toBe("created");
    const m = (await A.db.rpc("crm_intake", { _org: orgA, _source: "campanha", _payload: { name: "Lead", email: " NOVO@x.com" } })).data as { status: string };
    expect(m.status).toBe("matched");
    expect((await A.db.from("crm_intake_log").select("result").eq("organization_id", orgA)).data).toHaveLength(3);
    expect((await F.db.rpc("crm_intake", { _org: orgA, _source: "x", _payload: { name: "a", email: "a@a.com" } })).error).not.toBeNull();
  });

  it("edição e transferência de responsável entram no histórico", async () => {
    const { data: c } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Hist" }).select("id").single();
    await A.db.from("crm_contacts").update({ name: "Hist 2", owner_id: F.id }).eq("id", c!.id);
    const ev = (await A.db.from("crm_interactions").select("event").eq("contact_id", c!.id)).data!.map((e) => e.event);
    expect(ev).toEqual(expect.arrayContaining(["contact_updated", "owner_changed"]));
  });

  it("CPF/CNPJ só é visível para quem edita e é validado", async () => {
    const { data: c } = await A.db.from("crm_contacts").insert({ organization_id: orgA, name: "Doc" }).select("id").single();
    expect((await A.db.from("crm_contact_private").insert({ contact_id: c!.id, organization_id: orgA, doc: "111.111.111-11" })).error).not.toBeNull();
    expect((await A.db.from("crm_contact_private").insert({ contact_id: c!.id, organization_id: orgA, doc: "529.982.247-25" })).error).toBeNull();
    expect((await F.db.from("crm_contact_private").select("doc").eq("contact_id", c!.id)).data).toEqual([]);
  });
});
