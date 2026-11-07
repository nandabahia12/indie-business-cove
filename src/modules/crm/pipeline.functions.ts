import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError } from "@/lib/errors";
import { crmError, optText, orgInput, uuid } from "./shared";

export const listStages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ includeArchived: z.boolean().default(false) }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("crm_pipeline_stages").select("id, name, position, kind, is_default, archived_at")
      .eq("organization_id", data.organizationId).order("position");
    if (!data.includeArchived) q = q.is("archived_at", null);
    const r = await q;
    if (r.error) throw crmError(r.error);
    return r.data;
  });

const dealFilters = orgInput.extend({
  contactId: uuid.optional(),
  q: z.string().trim().max(120).optional(),
  ownerId: uuid.optional(),
  stageId: uuid.optional(),
});

export const listDeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => dealFilters.parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("crm_deals")
      .select("id, title, description, notes, value_cents, owner_id, expected_close_date, lost_reason, won_at, lost_at, created_at, stage_id, contact_id, crm_contacts(id, name)")
      .eq("organization_id", data.organizationId).order("created_at", { ascending: false }).limit(500);
    if (data.contactId) q = q.eq("contact_id", data.contactId);
    if (data.ownerId) q = q.eq("owner_id", data.ownerId);
    if (data.stageId) q = q.eq("stage_id", data.stageId);
    if (data.q) q = q.ilike("title", `%${data.q.replace(/[%,()*\\]/g, " ")}%`);
    const r = await q;
    if (r.error) throw crmError(r.error);
    return r.data;
  });

const dealSchema = z.object({
  contact_id: uuid,
  stage_id: uuid,
  title: z.string().trim().min(1, "Informe o título").max(200),
  description: optText(5000),
  notes: optText(5000),
  value_cents: z.number().int().min(0).max(1e13).nullable().optional(),
  owner_id: uuid.nullable().optional(),
  expected_close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  lost_reason: optText(500),
});

export const saveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ dealId: uuid.optional(), deal: dealSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.dealId) {
      const r = await supabase.from("crm_deals").update(data.deal).eq("organization_id", data.organizationId).eq("id", data.dealId).select("id").maybeSingle();
      if (r.error) throw crmError(r.error);
      if (!r.data) throw new AppError("forbidden", "Sem permissão para editar esta oportunidade.");
      return { id: r.data.id };
    }
    const r = await supabase.from("crm_deals").insert({ ...data.deal, organization_id: data.organizationId, owner_id: data.deal.owner_id ?? userId }).select("id").single();
    if (r.error) throw crmError(r.error);
    return { id: r.data.id };
  });

export const moveDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ dealId: uuid, stageId: uuid, lostReason: optText(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const patch: { stage_id: string; lost_reason?: string | null } = { stage_id: data.stageId };
    if (data.lostReason) patch.lost_reason = data.lostReason;
    const r = await context.supabase.from("crm_deals").update(patch).eq("organization_id", data.organizationId).eq("id", data.dealId).select("id").maybeSingle();
    if (r.error) throw crmError(r.error);
    if (!r.data) throw new AppError("forbidden", "Sem permissão para mover esta oportunidade.");
    return { ok: true };
  });

export const deleteDeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ dealId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_deals").delete().eq("organization_id", data.organizationId).eq("id", data.dealId).select("id");
    if (r.error) throw crmError(r.error);
    if (!r.data.length) throw new AppError("forbidden", "Sem permissão para excluir.");
    return { ok: true };
  });

// ===== Etapas (proprietário/administrador: crm.manage) =====
export const saveStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({ stageId: uuid.optional(), name: z.string().trim().min(1).max(60), kind: z.enum(["open", "won", "lost"]).default("open") }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.stageId) {
      const r = await supabase.from("crm_pipeline_stages").update({ name: data.name, kind: data.kind }).eq("organization_id", data.organizationId).eq("id", data.stageId).select("id").maybeSingle();
      if (r.error) throw crmError(r.error);
      if (!r.data) throw new AppError("forbidden", "Apenas proprietários e administradores podem alterar etapas.");
      return { id: r.data.id };
    }
    const max = await supabase.from("crm_pipeline_stages").select("position").eq("organization_id", data.organizationId).order("position", { ascending: false }).limit(1);
    const r = await supabase.from("crm_pipeline_stages")
      .insert({ organization_id: data.organizationId, name: data.name, kind: data.kind, position: (max.data?.[0]?.position ?? 0) + 1 }).select("id").single();
    if (r.error) throw crmError(r.error);
    return { id: r.data.id };
  });

export const reorderStages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ ids: z.array(uuid).min(1).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("crm_reorder_stages", { _org: data.organizationId, _ids: data.ids });
    if (r.error) throw crmError(r.error);
    return { ok: true };
  });

export const archiveStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ stageId: uuid, targetId: uuid.nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("crm_archive_stage", { _org: data.organizationId, _stage: data.stageId, ...(data.targetId ? { _target: data.targetId } : {}) } as never);
    if (r.error) throw crmError(r.error);
    return { moved: r.data as number };
  });

export const restoreStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ stageId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_pipeline_stages").update({ archived_at: null }).eq("organization_id", data.organizationId).eq("id", data.stageId).select("id").maybeSingle();
    if (r.error) throw crmError(r.error);
    if (!r.data) throw new AppError("forbidden", "Sem permissão.");
    return { ok: true };
  });

/** Excluir só funciona para etapas que nunca tiveram oportunidades (o banco impede o contrário). */
export const deleteStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ stageId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_pipeline_stages").delete().eq("organization_id", data.organizationId).eq("id", data.stageId).select("id");
    if (r.error) throw new AppError("conflict", "Esta etapa possui oportunidades. Arquive-a transferindo as oportunidades.");
    if (!r.data.length) throw new AppError("forbidden", "Sem permissão.");
    return { ok: true };
  });

export const getReminderDefault = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("organization_settings").select("value").eq("organization_id", data.organizationId).eq("key", "crm.reminder_default_days").maybeSingle();
    return { days: typeof r.data?.value === "number" ? r.data.value : 2 };
  });

export const setReminderDefault = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ days: z.number().int().min(0).max(365) }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("organization_settings").upsert({ organization_id: data.organizationId, key: "crm.reminder_default_days", value: data.days, updated_by: context.userId });
    if (r.error) throw crmError(r.error);
    return { ok: true };
  });
