import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError } from "@/lib/errors";
import { crmError, optText, orgInput, uuid } from "./shared";

export const listInteractions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_interactions")
      .select("id, kind, event, body, metadata, occurred_at, author_id, deal_id")
      .eq("organization_id", data.organizationId).eq("contact_id", data.contactId)
      .order("occurred_at", { ascending: false }).limit(300);
    if (r.error) throw crmError(r.error);
    return r.data;
  });

export const addInteraction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({
      contactId: uuid, dealId: uuid.nullable().optional(),
      kind: z.enum(["call", "whatsapp", "email", "meeting", "note"]),
      body: z.string().trim().min(1, "Descreva a interação").max(5000),
      occurredAt: z.string().datetime({ offset: true }).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_interactions").insert({
      organization_id: data.organizationId, contact_id: data.contactId, deal_id: data.dealId ?? null,
      kind: data.kind, body: data.body, author_id: context.userId,
      ...(data.occurredAt ? { occurred_at: data.occurredAt } : {}),
    }).select("id").single();
    if (r.error) throw crmError(r.error);
    return { id: r.data.id };
  });

const remFilters = orgInput.extend({
  contactId: uuid.optional(),
  assigneeId: uuid.optional(),
  view: z.enum(["pending", "overdue", "today", "upcoming", "done", "canceled", "all"]).default("pending"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const listReminders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => remFilters.parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("crm_reminders")
      .select("id, title, description, due_date, due_time, priority, status, assignee_id, is_auto, done_at, contact_id, deal_id, crm_contacts(id, name), crm_deals(id, title)")
      .eq("organization_id", data.organizationId).order("due_date").order("due_time", { nullsFirst: false }).limit(300);
    if (data.contactId) q = q.eq("contact_id", data.contactId);
    if (data.assigneeId) q = q.eq("assignee_id", data.assigneeId);
    if (data.from) q = q.gte("due_date", data.from);
    if (data.to) q = q.lte("due_date", data.to);
    switch (data.view) {
      case "pending": q = q.eq("status", "pending"); break;
      case "overdue": q = q.eq("status", "pending").lt("due_date", data.today); break;
      case "today": q = q.eq("status", "pending").eq("due_date", data.today); break;
      case "upcoming": q = q.eq("status", "pending").gt("due_date", data.today); break;
      case "done": q = q.eq("status", "done"); break;
      case "canceled": q = q.eq("status", "canceled"); break;
    }
    const r = await q;
    if (r.error) throw crmError(r.error);
    return r.data;
  });

const reminderSchema = z.object({
  contact_id: uuid,
  deal_id: uuid.nullable().optional(),
  title: z.string().trim().min(1, "Informe o título").max(200),
  description: optText(2000),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data"),
  due_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  assignee_id: uuid.nullable().optional(),
});

export const saveReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ reminderId: uuid.optional(), reminder: reminderSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.reminderId) {
      const r = await supabase.from("crm_reminders").update(data.reminder).eq("organization_id", data.organizationId).eq("id", data.reminderId).select("id").maybeSingle();
      if (r.error) throw crmError(r.error);
      if (!r.data) throw new AppError("forbidden", "Sem permissão.");
      return { id: r.data.id };
    }
    const r = await supabase.from("crm_reminders").insert({ ...data.reminder, organization_id: data.organizationId, assignee_id: data.reminder.assignee_id ?? userId }).select("id").single();
    if (r.error) throw crmError(r.error);
    return { id: r.data.id };
  });

export const setReminderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ reminderId: uuid, status: z.enum(["pending", "done", "canceled"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("crm_reminders").update({ status: data.status }).eq("organization_id", data.organizationId).eq("id", data.reminderId).select("id").maybeSingle();
    if (r.error) throw crmError(r.error);
    if (!r.data) throw new AppError("forbidden", "Sem permissão.");
    return { ok: true };
  });

// ===== Documentos do contato (bucket privado org-files, pasta {org}/crm/...) =====
export const listContactFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ contactId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("files").select("id, name, path, mime_type, size_bytes, created_at")
      .eq("organization_id", data.organizationId).eq("crm_contact_id", data.contactId).order("created_at", { ascending: false });
    if (r.error) throw crmError(r.error);
    return r.data;
  });

export const registerContactFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({
      contactId: uuid, path: z.string().max(500), name: z.string().trim().min(1).max(200),
      mimeType: z.string().max(120).nullable(), sizeBytes: z.number().int().min(0).max(50 * 1024 * 1024),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${data.organizationId}/crm/`)) throw new AppError("validation", "Caminho de arquivo inválido.");
    const r = await context.supabase.from("files").insert({
      organization_id: data.organizationId, bucket: "org-files", path: data.path, name: data.name,
      mime_type: data.mimeType, size_bytes: data.sizeBytes, module_key: "crm", crm_contact_id: data.contactId, uploaded_by: context.userId,
    }).select("id").single();
    if (r.error) throw crmError(r.error);
    return { id: r.data.id };
  });

export const getFileUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ fileId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const f = await context.supabase.from("files").select("path, bucket").eq("organization_id", data.organizationId).eq("id", data.fileId).maybeSingle();
    if (!f.data) throw new AppError("not_found", "Arquivo não encontrado.");
    const s = await context.supabase.storage.from(f.data.bucket).createSignedUrl(f.data.path, 60);
    if (s.error) throw new AppError("internal", "Não foi possível abrir o arquivo.");
    return { url: s.data.signedUrl };
  });

export const deleteContactFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ fileId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const f = await context.supabase.from("files").select("path, bucket").eq("organization_id", data.organizationId).eq("id", data.fileId).maybeSingle();
    if (!f.data) throw new AppError("not_found", "Arquivo não encontrado.");
    const d = await context.supabase.from("files").delete().eq("id", data.fileId).select("id");
    if (d.error) throw crmError(d.error);
    if (!d.data.length) throw new AppError("forbidden", "Sem permissão para remover.");
    await context.supabase.storage.from(f.data.bucket).remove([f.data.path]);
    return { ok: true };
  });
