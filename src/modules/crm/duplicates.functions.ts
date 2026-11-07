import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { logger } from "@/lib/logger";
import { crmError, orgInput, uuid } from "./shared";

export const listDuplicatePairs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const r = await supabase.rpc("crm_duplicate_pairs", { _org: data.organizationId });
    if (r.error) throw crmError(r.error);
    const ids = [...new Set((r.data ?? []).flatMap((p) => [p.a, p.b]))];
    const c = ids.length
      ? await supabase.from("crm_contacts").select("id, name, kind, email, phone, whatsapp, created_at, archived_at").in("id", ids)
      : { data: [] };
    const byId = new Map((c.data ?? []).map((x) => [x.id, x]));
    return (r.data ?? []).map((p) => ({ reason: p.reason, a: byId.get(p.a), b: byId.get(p.b) })).filter((p) => p.a && p.b);
  });

export const mergeContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ keepId: uuid, dropId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("crm_merge_contacts", { _org: data.organizationId, _keep: data.keepId, _drop: data.dropId });
    if (r.error) throw crmError(r.error);
    logger.info("crm.contacts_merged", { orgId: data.organizationId });
    return { ok: true };
  });

export const dismissDuplicate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ a: uuid, b: uuid }).refine((v) => v.a !== v.b).parse(i))
  .handler(async ({ data, context }) => {
    const [a, b] = [data.a, data.b].sort() as [string, string];
    const r = await context.supabase.from("crm_duplicate_dismissals").insert({ organization_id: data.organizationId, contact_a: a, contact_b: b });
    if (r.error && r.error.code !== "23505") throw crmError(r.error);
    return { ok: true };
  });

/** Recebimento interno de contatos de integrações futuras: valida, normaliza, checa duplicidade e registra o resultado. */
export const intakeContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({
      source: z.string().trim().min(1).max(60),
      payload: z.object({
        name: z.string().max(200).optional(), email: z.string().max(200).optional(), phone: z.string().max(40).optional(),
        whatsapp: z.string().max(40).optional(), doc: z.string().max(20).optional(), message: z.string().max(5000).optional(),
      }),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const r = await context.supabase.rpc("crm_intake", { _org: data.organizationId, _source: data.source, _payload: data.payload });
    if (r.error) throw crmError(r.error);
    return r.data as { status: "created" | "matched" | "rejected"; contact_id?: string; errors?: string[] };
  });
