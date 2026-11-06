import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromDbError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { allowedWidgets, resolveLayout, WIDGET_KEYS } from "./widgets";

const orgInput = z.object({ organizationId: z.string().uuid() });
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Painel: widgets filtrados por módulo ativo + permissão (no servidor), layout do usuário e recomendações reais. */
export const getDashboardData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ from: dateStr, to: dateStr }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const org = data.organizationId;
    const [mods, perms, layout, onb, members, settings] = await Promise.all([
      supabase.from("organization_modules").select("module_key").eq("organization_id", org).eq("enabled", true),
      supabase.rpc("my_org_permissions", { _org: org }),
      supabase.from("user_dashboard_layouts").select("widgets").eq("organization_id", org).eq("user_id", userId).maybeSingle(),
      supabase.from("organization_onboarding").select("status").eq("organization_id", org).maybeSingle(),
      supabase.from("organization_members").select("user_id", { count: "exact", head: true }).eq("organization_id", org).eq("status", "active"),
      supabase.from("organization_settings").select("value").eq("organization_id", org).eq("key", "timezone").maybeSingle(),
    ]);
    if (mods.error) throw fromDbError(mods.error);
    if (perms.error) throw fromDbError(perms.error);
    const enabled = (mods.data ?? []).map((m) => m.module_key);
    const permissions = (perms.data ?? []) as string[];
    const allowed = allowedWidgets(enabled, permissions);
    const items = resolveLayout(layout.data?.widgets, allowed);

    // Nenhum módulo de origem possui dados ainda: todos os widgets reportam o status do catálogo, sem números.
    const widgets = allowed.map((w) => ({ key: w.key, status: w.status, value: null as null }));

    const recommendations: { kind: "fact"; text: string; link?: "/app/onboarding" | "/app/members" }[] = [];
    if (onb.data?.status !== "completed" && permissions.includes("core.manage"))
      recommendations.push({ kind: "fact", text: "A configuração inicial ainda não foi concluída.", link: "/app/onboarding" });
    const pendingMods = [...new Set(allowed.filter((w) => w.status === "pending_module").map((w) => w.module))];
    if (pendingMods.length) recommendations.push({ kind: "fact", text: `Módulos ativos ainda em construção: ${pendingMods.join(", ")}. Os indicadores aparecerão assim que forem liberados.` });
    if ((members.count ?? 0) <= 1 && permissions.includes("core.manage"))
      recommendations.push({ kind: "fact", text: "Você ainda trabalha sozinho(a) aqui. Convide sua equipe quando precisar.", link: "/app/members" });

    return {
      period: { from: data.from, to: data.to },
      timezone: typeof settings.data?.value === "string" ? settings.data.value : "America/Bahia",
      layout: items,
      widgets,
      recommendations,
      hasCustomLayout: Boolean(layout.data),
    };
  });

export const saveDashboardLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({
      widgets: z.array(z.object({ key: z.enum(WIDGET_KEYS as [string, ...string[]]), visible: z.boolean() })).max(WIDGET_KEYS.length),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_dashboard_layouts").upsert({
      organization_id: data.organizationId,
      user_id: context.userId,
      widgets: data.widgets,
    });
    if (error) {
      logger.warn("dashboard.layout_save_failed", { code: error.code, orgId: data.organizationId });
      throw fromDbError(error);
    }
    return { ok: true };
  });

export const resetDashboardLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("user_dashboard_layouts").delete().eq("organization_id", data.organizationId).eq("user_id", context.userId);
    if (error) throw fromDbError(error);
    return { ok: true };
  });
