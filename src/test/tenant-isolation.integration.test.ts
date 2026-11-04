/**
 * Testes de isolamento multitenant contra o banco real (RLS ativo).
 * Cria usuários e organizações temporários e remove tudo ao final.
 * Requer SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente.
 */
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
const createdUsers: string[] = [];
const createdOrgs: string[] = [];

async function makeUser(label: string): Promise<{ id: string; email: string; db: DB }> {
  const email = `iso-${label}-${run}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw error ?? new Error("createUser");
  createdUsers.push(data.user.id);
  const db = createClient<Database>(URL!, ANON!, { auth: { ...opts.auth, storageKey: `iso-${label}` } });
  const { error: e2 } = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (e2) throw e2;
  return { id: data.user.id, email, db };
}

async function makeOrg(owner: DB, label: string) {
  const { data, error } = await owner.rpc("create_organization", { _name: `Iso ${label}`, _slug: `iso-${label}-${run}` });
  if (error || !data) throw error ?? new Error("create_organization");
  createdOrgs.push(data);
  return data;
}

async function invite(owner: DB, org: string, user: { email: string; db: DB }, role: Database["public"]["Enums"]["org_role"]) {
  const { data: token, error } = await owner.rpc("create_invitation", { _org: org, _email: user.email, _role: role });
  if (error || !token) throw error ?? new Error("create_invitation");
  const { error: e2 } = await user.db.rpc("accept_invitation", { _token: token });
  if (e2) throw e2;
}

describe.skipIf(!enabled)("isolamento entre organizações", { timeout: 30_000 }, () => {
  let A: Awaited<ReturnType<typeof makeUser>>;
  let B: Awaited<ReturnType<typeof makeUser>>;
  let F: Awaited<ReturnType<typeof makeUser>>;
  let C1: Awaited<ReturnType<typeof makeUser>>;
  let C2: Awaited<ReturnType<typeof makeUser>>;
  let X: Awaited<ReturnType<typeof makeUser>>;
  let orgA = "";
  let orgB = "";

  beforeAll(async () => {
    admin = createClient<Database>(URL!, SERVICE!, opts);
    const u = await Promise.all(["a", "b", "f", "c1", "c2", "x"].map(makeUser));
    [A, B, F, C1, C2, X] = u as [typeof A, typeof A, typeof A, typeof A, typeof A, typeof A];
    orgA = await makeOrg(A.db, "a");
    orgB = await makeOrg(B.db, "b");
    // Organização A habilita o módulo financeiro e cria dados sensíveis.
    for (const m of ["comercial", "financeiro", "producao", "agenda", "documentos"]) {
      const { error } = await A.db.from("organization_modules").upsert({ organization_id: orgA, module_key: m, enabled: true });
      if (error) throw error;
    }
    await A.db.from("organization_settings").insert({ organization_id: orgA, key: "segredo", value: { v: 1 } });
    await B.db.from("organization_settings").insert({ organization_id: orgB, key: "segredo", value: { v: 2 } });
    await invite(A.db, orgA, F, "freelancer");
    await invite(A.db, orgA, C1, "client");
    await invite(A.db, orgA, C2, "client");
    const files = [
      { organization_id: orgA, path: `${orgA}/financeiro/extrato.pdf`, name: "extrato.pdf", module_key: "financeiro", uploaded_by: A.id },
      { organization_id: orgA, path: `${orgA}/producao/briefing.pdf`, name: "briefing.pdf", module_key: "producao", uploaded_by: A.id },
      { organization_id: orgA, path: `${orgA}/core/c1.pdf`, name: "c1.pdf", module_key: null, uploaded_by: A.id, client_user_id: C1.id },
      { organization_id: orgA, path: `${orgA}/core/c2.pdf`, name: "c2.pdf", module_key: null, uploaded_by: A.id, client_user_id: C2.id },
    ];
    const { error } = await A.db.from("files").insert(files);
    if (error) throw error;
  }, 60_000);

  afterAll(async () => {
    if (!admin) return;
    if (createdOrgs.length) await admin.from("organizations").delete().in("id", createdOrgs);
    await Promise.all(createdUsers.map((id) => admin.auth.admin.deleteUser(id)));
  }, 60_000);

  it("usuário de A não enxerga a organização B", async () => {
    const { data } = await A.db.from("organizations").select("id");
    expect(data?.map((o) => o.id)).toEqual([orgA]);
    const { data: other } = await A.db.from("organizations").select("id").eq("id", orgB);
    expect(other).toEqual([]);
  });

  it("membros, configurações e arquivos de B ficam invisíveis para A", async () => {
    for (const table of ["organization_members", "organization_settings", "files", "audit_logs", "organization_invitations"] as const) {
      const { data } = await A.db.from(table).select("organization_id").eq("organization_id", orgB);
      expect(data, table).toEqual([]);
    }
    const { data: profiles } = await A.db.from("profiles").select("id").eq("id", B.id);
    expect(profiles).toEqual([]);
  });

  it("A não consegue gravar dados em B mesmo enviando o ID de B", async () => {
    const s = await A.db.from("organization_settings").insert({ organization_id: orgB, key: "x", value: {} });
    expect(s.error).not.toBeNull();
    const f = await A.db.from("files").insert({ organization_id: orgB, path: `${orgB}/core/x.pdf`, name: "x", uploaded_by: A.id });
    expect(f.error).not.toBeNull();
    const u = await A.db.from("organizations").update({ name: "hack" }).eq("id", orgB).select();
    expect(u.data ?? []).toEqual([]);
    const { data: still } = await admin.from("organizations").select("name").eq("id", orgB).single();
    expect(still?.name).toBe("Iso b");
  });

  it("A não consegue convidar, alterar papéis ou remover membros de B", async () => {
    expect((await A.db.rpc("create_invitation", { _org: orgB, _email: A.email, _role: "admin" })).error).not.toBeNull();
    expect((await A.db.rpc("set_member_role", { _org: orgB, _user: B.id, _role: "client" })).error).not.toBeNull();
    expect((await A.db.rpc("remove_member", { _org: orgB, _user: B.id })).error).not.toBeNull();
  });

  it("A não consegue enviar arquivo para a pasta de B", async () => {
    const { error } = await A.db.storage.from("org-files").upload(`${orgB}/core/x-${run}.txt`, new TextEncoder().encode("x"), { contentType: "text/plain" });
    expect(error).not.toBeNull();
  });

  it("controle positivo: A envia e lê arquivo na própria organização", async () => {
    const path = `${orgA}/core/ok-${run}.txt`;
    const up = await A.db.storage.from("org-files").upload(path, new TextEncoder().encode("ok"), { contentType: "text/plain" });
    expect(up.error).toBeNull();
    await A.db.from("files").insert({ organization_id: orgA, path, name: "ok.txt", uploaded_by: A.id });
    const dl = await A.db.storage.from("org-files").download(path);
    expect(dl.error).toBeNull();
    const other = await B.db.storage.from("org-files").download(path);
    expect(other.error).not.toBeNull();
    await admin.storage.from("org-files").remove([path]);
  });

  it("não é possível entrar em uma organização com convite de outra pessoa", async () => {
    const { data: token } = await B.db.rpc("create_invitation", { _org: orgB, _email: "outra-pessoa@example.com", _role: "collaborator" });
    expect(token).toBeTruthy();
    expect((await X.db.rpc("accept_invitation", { _token: token! })).error).not.toBeNull();
    const { data } = await X.db.from("organizations").select("id");
    expect(data).toEqual([]);
  });

  it("freelancer não acessa dados financeiros", async () => {
    const { data: perms } = await F.db.rpc("my_org_permissions", { _org: orgA });
    expect(perms).not.toContain("financeiro.read");
    expect(perms).toContain("producao.read");
    const { data: files } = await F.db.from("files").select("name").eq("organization_id", orgA);
    expect(files?.map((f) => f.name)).toEqual(["briefing.pdf"]);
    const up = await F.db.from("files").insert({ organization_id: orgA, path: `${orgA}/financeiro/y.pdf`, name: "y", module_key: "financeiro", uploaded_by: F.id });
    expect(up.error).not.toBeNull();
    const st = await F.db.storage.from("org-files").upload(`${orgA}/financeiro/y-${run}.txt`, new TextEncoder().encode("y"), { contentType: "text/plain" });
    expect(st.error).not.toBeNull();
  });

  it("freelancer não pode se promover", async () => {
    expect((await F.db.rpc("set_member_role", { _org: orgA, _user: F.id, _role: "admin" })).error).not.toBeNull();
    const ins = await F.db.from("organization_member_roles").insert({ organization_id: orgA, user_id: F.id, role: "owner" });
    expect(ins.error).not.toBeNull();
  });

  it("cliente final só vê os próprios registros", async () => {
    const { data: files } = await C1.db.from("files").select("name").eq("organization_id", orgA);
    expect(files?.map((f) => f.name)).toEqual(["c1.pdf"]);
    const { data: members } = await C1.db.from("organization_members").select("user_id").eq("organization_id", orgA);
    expect(members?.map((m) => m.user_id)).toEqual([C1.id]);
    const { data: profiles } = await C1.db.from("profiles").select("id").in("id", [C2.id, A.id]);
    expect(profiles).toEqual([]);
    const { data: settings } = await C1.db.from("organization_settings").select("key").eq("organization_id", orgA);
    expect(settings).toEqual([]);
  });

  it("operações sensíveis ficam registradas na auditoria", async () => {
    const { data } = await A.db.from("audit_logs").select("action").eq("organization_id", orgA);
    const actions = data?.map((r) => r.action) ?? [];
    expect(actions).toContain("organization.created");
    expect(actions).toContain("invitation.created");
    expect(actions).toContain("invitation.accepted");
    expect(actions).toContain("organization_modules.insert");
  });
});
