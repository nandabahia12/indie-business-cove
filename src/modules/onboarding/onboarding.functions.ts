import { createServerFn } from "@tanstack/react-start";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError, fromDbError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { recommend, type OnboardingAnswers, type Recommendation, type SegmentTemplate } from "./recommend";

const orgInput = z.object({ organizationId: z.string().uuid() });
const list = z.array(z.string().trim().min(1).max(120)).max(30);
const answersSchema = z.object({
  business_name: z.string().trim().max(120).nullable(),
  segment_key: z.string().trim().max(60).nullable(),
  main_activity: z.string().trim().max(300).nullable(),
  services: list,
  audience: list,
  billing_models: list,
  team_size: z.enum(["solo", "2-5", "6-15", "16+"]).nullable(),
  pains: list,
  admin_needs: list,
  finance_needs: list,
  marketing_needs: list,
});

const ANSWER_COLS = "business_name, segment_key, main_activity, services, audience, billing_models, team_size, pains, admin_needs, finance_needs, marketing_needs";

/** Estado do onboarding + catálogo de segmentos. RLS garante o tenant. */
export const getOnboarding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [row, templates, preset] = await Promise.all([
      supabase.from("organization_onboarding").select(`status, current_step, ${ANSWER_COLS}`).eq("organization_id", data.organizationId).maybeSingle(),
      supabase.from("segment_templates").select("key, name, description, billing_suggestions, sensitive_data, privacy_notice").order("sort_order"),
      supabase.rpc("get_org_preset", { _org: data.organizationId }),
    ]);
    if (row.error) throw fromDbError(row.error);
    if (templates.error) throw fromDbError(templates.error);
    return { onboarding: row.data, templates: templates.data, preset: (preset.data ?? null) as null | { key: string; name: string; segment_key: string | null; settings: Record<string, Json> } };
  });

export const saveOnboardingStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ step: z.number().int().min(0).max(50), answers: answersSchema }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("organization_onboarding").upsert({
      organization_id: data.organizationId,
      current_step: data.step,
      ...data.answers,
      updated_by: context.userId,
    });
    if (error) {
      logger.warn("onboarding.save_failed", { code: error.code, orgId: data.organizationId });
      throw fromDbError(error);
    }
    return { ok: true };
  });

/** Gera recomendações: regras sempre; IA opcional e restrita ao catálogo. */
export const recommendOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ useAi: z.boolean() }).parse(i))
  .handler(async ({ data, context }): Promise<{ recommendation: Recommendation; aiError: string | null }> => {
    const { supabase } = context;
    const { data: row, error } = await supabase.from("organization_onboarding").select(ANSWER_COLS).eq("organization_id", data.organizationId).maybeSingle();
    if (error) throw fromDbError(error);
    if (!row) throw new AppError("not_found", "Responda as perguntas primeiro.");
    const answers = row as OnboardingAnswers;
    const [{ data: tpl }, { data: catalog, error: ce }] = await Promise.all([
      answers.segment_key
        ? supabase.from("segment_templates").select("key, name, modules, future_modules, flows, sensitive_data, privacy_notice").eq("key", answers.segment_key).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("modules").select("key, name, is_core, is_available").order("sort_order"),
    ]);
    if (ce) throw fromDbError(ce);
    const rec = recommend(answers, (tpl as SegmentTemplate | null) ?? null, catalog ?? []);
    let aiError: string | null = null;

    if (data.useAi) {
      const { refineWithAi } = await import("./ai.server");
      const ai = await refineWithAi(answers, tpl?.name ?? null, catalog ?? [], rec.modules.map((m) => m.key));
      if ("error" in ai) aiError = ai.error;
      else {
        const names = new Map((catalog ?? []).map((m) => [m.key, m.name]));
        for (const m of ai.modules) {
          const existing = rec.modules.find((x) => x.key === m.key);
          if (existing) existing.reason = m.reason;
          else rec.modules.push({ key: m.key, name: names.get(m.key) ?? m.key, reason: m.reason, source: "ia" });
        }
        rec.aiSummary = ai.summary;
        rec.aiUsed = true;
      }
    }
    await supabase.from("organization_onboarding").update({ recommendation: rec as never }).eq("organization_id", data.organizationId);
    return { recommendation: rec, aiError };
  });

const flowSchema = z.object({ key: z.string().max(60), name: z.string().trim().min(1).max(120), steps: z.array(z.string().trim().min(1).max(80)).max(20) });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({
      businessName: z.string().trim().min(1).max(120),
      segment: z.string().max(60),
      modules: z.array(z.string().max(60)).max(30),
      rejected: z.array(z.string().max(60)).max(30),
      interests: z.array(z.string().max(60)).max(30),
      timezone: z.string().trim().min(1).max(60),
      flows: z.array(flowSchema).max(10),
      applyPreset: z.boolean(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const settings: Record<string, unknown> = {
      currency: "BRL", locale: "pt-BR", date_format: "dd/MM/yyyy", timezone: data.timezone, flows: data.flows,
    };
    if (data.applyPreset) {
      // O preset só é devolvido para owner/admin da organização a que foi vinculado.
      const { data: preset } = await supabase.rpc("get_org_preset", { _org: data.organizationId });
      const p = preset as { key: string; settings: Record<string, Json> } | null;
      if (!p) throw new AppError("forbidden", "Nenhuma configuração preparada para esta organização.");
      for (const k of ["service_packages", "commercial_terms"]) if (k in p.settings) settings[k] = p.settings[k];
      settings["preset_applied"] = p.key;
    }
    const { error } = await supabase.rpc("complete_onboarding", {
      _org: data.organizationId,
      _business_name: data.businessName,
      _segment: data.segment,
      _modules: data.modules,
      _interests: data.interests,
      _settings: settings as never,
      _decisions: { accepted: data.modules, rejected: data.rejected, interests: data.interests } as never,
    });
    if (error) {
      logger.warn("onboarding.complete_failed", { code: error.code, orgId: data.organizationId });
      throw fromDbError(error);
    }
    logger.info("onboarding.completed", { orgId: data.organizationId, userId: context.userId });
    return { ok: true };
  });

/** Dados do dashboard: módulos ativos, fluxos e configurações gravadas. */
export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [mods, settings, onb] = await Promise.all([
      supabase.from("organization_modules").select("module_key, enabled, modules(name, description, sort_order, is_core)").eq("organization_id", data.organizationId).eq("enabled", true),
      supabase.from("organization_settings").select("key, value").eq("organization_id", data.organizationId),
      supabase.from("organization_onboarding").select("status, segment_key").eq("organization_id", data.organizationId).maybeSingle(),
    ]);
    if (mods.error) throw fromDbError(mods.error);
    const s = Object.fromEntries((settings.data ?? []).map((r) => [r.key, r.value]));
    return {
      modules: (mods.data ?? []).map((m) => ({ key: m.module_key, ...(m.modules as { name: string; description: string | null; sort_order: number; is_core: boolean }) })).sort((a, b) => a.sort_order - b.sort_order),
      settings: s as Record<string, Json>,
      onboardingStatus: onb.data?.status ?? null,
    };
  });
