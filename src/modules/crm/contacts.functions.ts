import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { digits, emailNorm, isValidDoc } from "./normalize";
import { crmError, optText, orgInput, uuid } from "./shared";

const CONTACT_COLS =
  "id, kind, name, trade_name, email, phone, whatsapp, source, category, relationship, owner_id, created_by, created_at, updated_at, archived_at, merged_into_id";

const listInput = orgInput.extend({
  q: z.string().trim().max(120).optional(),
  kind: z.enum(["pf", "pj"]).optional(),
  relationship: z.enum(["lead", "client", "partner", "other"]).optional(),
  category: z.string().max(80).optional(),
  source: z.string().max(80).optional(),
  tagId: uuid.optional(),
  stageId: uuid.optional(),
  ownerId: uuid.optional(),
  status: z.enum(["active", "archived", "all"]).default("active"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(["name", "created_at", "updated_at"]).default("created_at"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).max(10_000).default(1),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]).default(25),
});

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organizationId;
    let restrictIds: string[] | null = null;
    const intersect = (ids: string[]) => {
      restrictIds = restrictIds === null ? ids : restrictIds.filter((x) => ids.includes(x));
    };
    if (data.tagId) {
      const r = await supabase.from("crm_contact_tags").select("contact_id").eq("organization_id", org).eq("tag_id", data.tagId);
      if (r.error) throw crmError(r.error);
      intersect(r.data.map((x) => x.contact_id));
    }
    if (data.stageId) {
      const r = await supabase.from("crm_deals").select("contact_id").eq("organization_id", org).eq("stage_id", data.stageId);
      if (r.error) throw crmError(r.error);
      intersect([...new Set(r.data.map((x) => x.contact_id))]);
    }

    let query = supabase.from("crm_contacts").select(CONTACT_COLS, { count: "exact" }).eq("organization_id", org).is("merged_into_id", null);
    if (data.status === "active") query = query.is("archived_at", null);
    if (data.status === "archived") query = query.not("archived_at", "is", null);
    if (data.kind) query = query.eq("kind", data.kind);
    if (data.relationship) query = query.eq("relationship", data.relationship);
    if (data.category) query = query.eq("category", data.category);
    if (data.source) query = query.eq("source", data.source);
    if (data.ownerId) query = query.eq("owner_id", data.ownerId);
    if (data.from) query = query.gte("created_at", `${data.from}T00:00:00-03:00`);
    if (data.to) query = query.lte("created_at", `${data.to}T23:59:59-03:00`);

    if (data.q) {
      const safe = data.q.replace(/[,()*%\\]/g, " ").trim();
      const em = emailNorm(safe);
      const dg = digits(safe);
      const ors = [`name.ilike.*${safe}*`, `trade_name.ilike.*${safe}*`];
      if (em) ors.push(`email_norm.ilike.*${em}*`);
      // Números: compara apenas dígitos (ignora máscara, espaços, +55).
      const extra: string[] = [];
      if (dg && dg.length >= 3) {
        const d = dg.length >= 12 && dg.startsWith("55") ? dg.slice(2) : dg;
        ors.push(`phone_digits.like.*${d}*`, `whatsapp_digits.like.*${d}*`);
        const [ch, doc] = await Promise.all([
          supabase.from("crm_contact_channels").select("contact_id").eq("organization_id", org).like("norm", `%${d}%`).limit(200),
          supabase.from("crm_contact_private").select("contact_id").eq("organization_id", org).like("doc_digits", `%${dg}%`).limit(200),
        ]);
        extra.push(...(ch.data ?? []).map((x) => x.contact_id), ...(doc.data ?? []).map((x) => x.contact_id));
      }
      if (em) {
        const ch = await supabase.from("crm_contact_channels").select("contact_id").eq("organization_id", org).ilike("norm", `%${em}%`).limit(200);
        extra.push(...(ch.data ?? []).map((x) => x.contact_id));
      }
      if (extra.length) ors.push(`id.in.(${[...new Set(extra)].join(",")})`);
      query = query.or(ors.join(","));
    }
    if (restrictIds !== null) {
      const ids: string[] = restrictIds;
      if (!ids.length) return { rows: [], total: 0, page: data.page, pageSize: data.pageSize };
      query = query.in("id", ids.slice(0, 500));
    }
    const fromIdx = (data.page - 1) * data.pageSize;
    query = query.order(data.sort, { ascending: data.dir === "asc" }).range(fromIdx, fromIdx + data.pageSize - 1);
    const { data: rows, error, count } = await query;
    if (error) throw crmError(error);

    const ids = (rows ?? []).map((r) => r.id);
    const tags = ids.length
      ? await supabase.from("crm_contact_tags").select("contact_id, crm_tags(id, name)").in("contact_id", ids)
      : { data: [] as { contact_id: string; crm_tags: { id: string; name: string } | null }[] };
    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        tags: (tags.data ?? []).filter((t) => t.contact_id === r.id).map((t) => t.crm_tags).filter(Boolean) as { id: string; name: string }[],
      })),
      total: count ?? 0,
      page: data.page,
      pageSize: data.pageSize,
    };
  });

export const getCrmFilters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organizationId;
    const [tags, cats, members] = await Promise.all([
      supabase.from("crm_tags").select("id, name").eq("organization_id", org).order("name"),
      supabase.from("crm_contacts").select("category, source").eq("organization_id", org).limit(1000),
      supabase.from("organization_members").select("user_id").eq("organization_id", org).eq("status", "active"),
    ]);
    if (tags.error) throw crmError(tags.error);
    const ids = (members.data ?? []).map((m) => m.user_id);
    const profiles = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => Boolean(x)))].sort();
    return {
      tags: tags.data ?? [],
      categories: uniq((cats.data ?? []).map((c) => c.category)),
      sources: uniq((cats.data ?? []).map((c) => c.source)),
      members: ids.map((id) => ({ id, name: profiles.data?.find((p) => p.id === id)?.full_name ?? "Sem nome" })),
    };
  });

export const getContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const org = data.organizationId;
    const c = await supabase.from("crm_contacts").select("*").eq("organization_id", org).eq("id", data.contactId).maybeSingle();
    if (c.error) throw crmError(c.error);
    if (!c.data) throw new AppError("not_found", "Contato não encontrado.");
    const [channels, tags, priv] = await Promise.all([
      supabase.from("crm_contact_channels").select("id, type, value, label, is_primary").eq("contact_id", c.data.id).order("created_at"),
      supabase.from("crm_contact_tags").select("crm_tags(id, name)").eq("contact_id", c.data.id),
      // RLS só devolve o documento para quem pode editar contatos.
      supabase.from("crm_contact_private").select("doc").eq("contact_id", c.data.id).maybeSingle(),
    ]);
    const { email_norm: _e, phone_digits: _p, whatsapp_digits: _w, ...contact } = c.data;
    return {
      contact,
      channels: channels.data ?? [],
      tags: (tags.data ?? []).map((t) => t.crm_tags).filter(Boolean) as { id: string; name: string }[],
      doc: priv.data?.doc ?? null,
    };
  });

const channelSchema = z.object({
  type: z.enum(["email", "phone", "whatsapp"]),
  value: z.string().trim().min(1).max(200),
  label: z.enum(["personal", "work", "whatsapp", "other"]).default("other"),
  is_primary: z.boolean().default(false),
});

export const contactSchema = z.object({
  kind: z.enum(["pf", "pj"]),
  name: z.string().trim().min(1, "Informe o nome").max(200),
  trade_name: optText(200),
  email: optText(200).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido"),
  phone: optText(40),
  whatsapp: optText(40),
  doc: optText(20).refine((v) => !v || isValidDoc(v), "CPF/CNPJ inválido"),
  address_street: optText(200), address_number: optText(20), address_complement: optText(100),
  address_district: optText(100), address_city: optText(100), address_state: optText(2), address_zip: optText(12),
  source: optText(80), category: optText(80),
  relationship: z.enum(["lead", "client", "partner", "other"]),
  notes: optText(5000), preferences: optText(2000),
  pj_contact_name: optText(200), pj_contact_role: optText(100), pj_contact_email: optText(200), pj_contact_phone: optText(40),
  owner_id: uuid.nullable().optional(),
  channels: z.array(channelSchema).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
});
export type ContactInput = z.input<typeof contactSchema>;

export const saveContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid.optional(), contact: contactSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = data.organizationId;
    const { channels, tags, doc, ...fields } = data.contact;
    let id = data.contactId;
    if (id) {
      const r = await supabase.from("crm_contacts").update(fields).eq("organization_id", org).eq("id", id).select("id").maybeSingle();
      if (r.error) throw crmError(r.error);
      if (!r.data) throw new AppError("forbidden", "Sem permissão para editar este contato.");
    } else {
      const r = await supabase.from("crm_contacts").insert({ ...fields, organization_id: org, owner_id: fields.owner_id ?? userId }).select("id").single();
      if (r.error) throw crmError(r.error);
      id = r.data.id;
    }
    // Documento: grava só se informado (criação) ou se o usuário puder editar (RLS).
    if (doc !== null || data.contactId) {
      const p = doc === null
        ? await supabase.from("crm_contact_private").delete().eq("contact_id", id)
        : await supabase.from("crm_contact_private").upsert({ contact_id: id, organization_id: org, doc });
      if (p.error) throw crmError(p.error);
    }
    const del = await supabase.from("crm_contact_channels").delete().eq("contact_id", id);
    if (del.error && data.contactId) throw crmError(del.error);
    if (channels.length) {
      const r = await supabase.from("crm_contact_channels").insert(channels.map((c) => ({ ...c, organization_id: org, contact_id: id! })));
      if (r.error) throw crmError(r.error);
    }
    // Etiquetas: cria as que não existem e substitui o vínculo.
    const names = [...new Map(tags.map((t) => [t.toLowerCase(), t])).values()];
    const existing = await supabase.from("crm_tags").select("id, name").eq("organization_id", org);
    const map = new Map((existing.data ?? []).map((t) => [t.name.toLowerCase(), t.id]));
    const missing = names.filter((n) => !map.has(n.toLowerCase()));
    if (missing.length) {
      const r = await supabase.from("crm_tags").insert(missing.map((name) => ({ organization_id: org, name }))).select("id, name");
      if (r.error) throw crmError(r.error);
      r.data.forEach((t) => map.set(t.name.toLowerCase(), t.id));
    }
    await supabase.from("crm_contact_tags").delete().eq("contact_id", id);
    if (names.length) {
      const r = await supabase.from("crm_contact_tags").insert(names.map((n) => ({ contact_id: id!, tag_id: map.get(n.toLowerCase())!, organization_id: org })));
      if (r.error) throw crmError(r.error);
    }
    logger.info("crm.contact_saved", { orgId: org, created: !data.contactId });
    return { id: id! };
  });

export const setContactArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid, archived: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_contacts")
      .update({ archived_at: data.archived ? new Date().toISOString() : null })
      .eq("organization_id", data.organizationId).eq("id", data.contactId).select("id").maybeSingle();
    if (r.error) throw crmError(r.error);
    if (!r.data) throw new AppError("forbidden", "Sem permissão.");
    return { ok: true };
  });

export const transferContactOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid, ownerId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const m = await supabase.from("organization_members").select("user_id").eq("organization_id", data.organizationId).eq("user_id", data.ownerId).eq("status", "active").maybeSingle();
    if (!m.data) throw new AppError("validation", "O novo responsável precisa ser membro ativo da organização.");
    const r = await supabase.from("crm_contacts").update({ owner_id: data.ownerId }).eq("organization_id", data.organizationId).eq("id", data.contactId).select("id").maybeSingle();
    if (r.error) throw crmError(r.error);
    if (!r.data) throw new AppError("forbidden", "Sem permissão.");
    return { ok: true };
  });

/** Exclusão definitiva: só proprietário/administrador (crm.manage), e só sem oportunidades vinculadas. */
export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const r = await supabase.from("crm_contacts").delete().eq("organization_id", data.organizationId).eq("id", data.contactId).select("id");
    if (r.error) throw crmError(r.error);
    if (!r.data.length) throw new AppError("forbidden", "Apenas proprietários e administradores podem excluir contatos.");
    logger.info("crm.contact_deleted", { orgId: data.organizationId });
    return { ok: true };
  });

export const checkDuplicates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({
      email: z.string().max(200).optional().nullable(), phone: z.string().max(40).optional().nullable(),
      whatsapp: z.string().max(40).optional().nullable(), doc: z.string().max(20).optional().nullable(),
      extra: z.array(z.string().max(200)).max(20).default([]), excludeId: uuid.optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const calls = [{ e: data.email, p: data.phone, w: data.whatsapp, d: data.doc }, ...data.extra.map((v) => (v.includes("@") ? { e: v } : { p: v }))];
    const out = new Map<string, { id: string; name: string; email: string | null; phone: string | null; archived: boolean; reason: string }>();
    for (const c of calls) {
      if (!c.e && !c.p && !("w" in c && c.w) && !("d" in c && c.d)) continue;
      const r = await context.supabase.rpc("crm_find_duplicates", {
        _org: data.organizationId, _email: c.e ?? "", _phone: c.p ?? "",
        _whatsapp: ("w" in c ? c.w : null) ?? "", _doc: ("d" in c ? c.d : null) ?? "", ...(data.excludeId ? { _exclude: data.excludeId } : {}),
      });
      if (r.error) throw crmError(r.error);
      for (const x of r.data ?? []) out.set(x.id, x);
    }
    return [...out.values()];
  });
