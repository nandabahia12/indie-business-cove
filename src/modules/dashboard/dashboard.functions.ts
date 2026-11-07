import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fromDbError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { allowedWidgets, resolveLayout, WIDGET_KEYS } from "./widgets";

export type WidgetItem = { id: string; label: string; sub: string; to: "contact"; extra?: string | null };
export type WidgetValue =
  | { kind: "list"; total: number; items: WidgetItem[] }
  | { kind: "kpis"; total: number; stats: { label: string; value: string; money: number | null }[]; byStage?: { name: string; count: number }[]; items?: WidgetItem[] };

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

    const tz = typeof settings.data?.value === "string" ? settings.data.value : "America/Bahia";
    const values: Record<string, WidgetValue> = {};
    const has = (k: string) => allowed.some((w) => w.key === k);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    const fromTs = `${data.from}T00:00:00-03:00`;
    const toTs = `${data.to}T23:59:59-03:00`;
    if (has("leads")) {
      const r = await supabase.from("crm_contacts").select("id, name, created_at", { count: "exact" })
        .eq("organization_id", org).eq("relationship", "lead").is("merged_into_id", null).is("archived_at", null)
        .gte("created_at", fromTs).lte("created_at", toTs).order("created_at", { ascending: false }).limit(5);
      if (!r.error) values["leads"] = { kind: "list", total: r.count ?? 0, items: r.data.map((c) => ({ id: c.id, label: c.name, sub: c.created_at, to: "contact" })) };
    }
    if (has("commercial_kpis")) {
      const [st, dl] = await Promise.all([
        supabase.from("crm_pipeline_stages").select("id, name, kind, position").eq("organization_id", org).is("archived_at", null).order("position"),
        supabase.from("crm_deals").select("stage_id, value_cents, won_at, lost_at, created_at").eq("organization_id", org).limit(5000),
      ]);
      if (!st.error && !dl.error) {
        const deals = dl.data;
        const inPeriod = (t: string | null) => Boolean(t && t >= fromTs.slice(0, 10) && t.slice(0, 10) <= data.to);
        const won = deals.filter((d) => inPeriod(d.won_at));
        const lost = deals.filter((d) => inPeriod(d.lost_at));
        const kinds = new Map(st.data.map((s) => [s.id, s.kind]));
        const open = deals.filter((d) => kinds.get(d.stage_id) === "open");
        const sum = (xs: typeof deals) => xs.reduce((a, d) => a + (d.value_cents ?? 0), 0);
        values["commercial_kpis"] = {
          kind: "kpis", total: deals.length,
          stats: [
            { label: "Em aberto", value: String(open.length), money: sum(open) },
            { label: "Contratadas no período", value: String(won.length), money: sum(won) },
            { label: "Perdidas no período", value: String(lost.length), money: sum(lost) },
            { label: "Conversão no período", value: won.length + lost.length ? `${Math.round((won.length / (won.length + lost.length)) * 100)}%` : "—", money: null },
          ],
          byStage: st.data.map((s) => ({ name: s.name, count: deals.filter((d) => d.stage_id === s.id).length })),
        };
      }
    }
    if (has("crm_activities")) {
      const base = () => supabase.from("crm_reminders").select("id", { count: "exact", head: true }).eq("organization_id", org);
      const [todayC, overdue, pending, done, next] = await Promise.all([
        base().eq("status", "pending").eq("due_date", today),
        base().eq("status", "pending").lt("due_date", today),
        base().eq("status", "pending"),
        base().eq("status", "done").gte("done_at", fromTs).lte("done_at", toTs),
        supabase.from("crm_reminders").select("id, title, due_date, contact_id, crm_contacts(name)").eq("organization_id", org)
          .eq("status", "pending").gte("due_date", today).order("due_date").limit(5),
      ]);
      values["crm_activities"] = {
        kind: "kpis", total: (pending.count ?? 0) + (done.count ?? 0),
        stats: [
          { label: "Hoje", value: String(todayC.count ?? 0), money: null },
          { label: "Atrasadas", value: String(overdue.count ?? 0), money: null },
          { label: "Pendentes", value: String(pending.count ?? 0), money: null },
          { label: "Concluídas no período", value: String(done.count ?? 0), money: null },
        ],
        items: (next.data ?? []).map((r) => ({ id: r.contact_id, label: r.title, sub: r.due_date, to: "contact" as const, extra: (r.crm_contacts as { name: string } | null)?.name ?? null })),
      };
    }
    const widgets = allowed.map((w) => ({ key: w.key, status: w.status, value: values[w.key] ?? null }));

    const recommendations: { kind: "fact"; text: string; link?: "/app/onboarding" | "/app/members" }[] = [];
    if (onb.data?.status !== "completed" && permissions.includes("core.manage"))
      recommendations.push({ kind: "fact", text: "A configuração inicial ainda não foi concluída.", link: "/app/onboarding" });
    const pendingMods = [...new Set(allowed.filter((w) => w.status === "pending_module").map((w) => w.module))];
    if (pendingMods.length) recommendations.push({ kind: "fact", text: `Módulos ativos ainda em construção: ${pendingMods.join(", ")}. Os indicadores aparecerão assim que forem liberados.` });
    if ((members.count ?? 0) <= 1 && permissions.includes("core.manage"))
      recommendations.push({ kind: "fact", text: "Você ainda trabalha sozinho(a) aqui. Convide sua equipe quando precisar.", link: "/app/members" });

    return {
      period: { from: data.from, to: data.to },
      timezone: tz,
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
