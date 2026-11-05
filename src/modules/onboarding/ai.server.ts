import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import { z } from "zod";
import { logger } from "@/lib/logger";
import type { CatalogModule, OnboardingAnswers } from "./recommend";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

const schema = z.object({
  modules: z.array(z.object({ key: z.string(), reason: z.string() })),
  summary: z.string(),
});

export type AiRefinement = { modules: { key: string; reason: string }[]; summary: string };

/**
 * Refina a sugestão com IA usando apenas as respostas desta organização.
 * A IA só pode escolher entre módulos existentes; chaves desconhecidas são descartadas.
 */
export async function refineWithAi(
  answers: OnboardingAnswers,
  segmentName: string | null,
  catalog: CatalogModule[],
  baseKeys: string[],
): Promise<AiRefinement | { error: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { error: "IA indisponível no momento." };
  const available = catalog.filter((m) => m.is_available && !m.is_core);
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  try {
    const result = streamText({
      model: provider.responses(MODEL),
      instructions:
        "Você ajuda a configurar um sistema de gestão para pequenos negócios. Responda em português do Brasil. " +
        "Escolha apenas módulos da lista fornecida, usando a chave exata. Não invente dados, preços ou integrações. " +
        "Para cada módulo, dê um motivo curto (até 15 palavras) ligado às respostas. O resumo deve ter até 2 frases.",
      messages: [{
        role: "user",
        content: JSON.stringify({
          segmento: segmentName,
          respostas: answers,
          modulos_disponiveis: available.map((m) => ({ chave: m.key, nome: m.name })),
          sugestao_inicial: baseKeys,
        }),
      }],
      output: Output.object({ schema }),
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    const out = await result.output;
    const valid = new Set(available.map((m) => m.key));
    return {
      modules: out.modules.filter((m) => valid.has(m.key)).map((m) => ({ key: m.key, reason: m.reason.slice(0, 200) })),
      summary: out.summary.slice(0, 400),
    };
  } catch (err) {
    const status = (err as { statusCode?: number }).statusCode;
    logger.warn("onboarding.ai_failed", { status, kind: NoObjectGeneratedError.isInstance(err) ? "no_object" : "call" });
    if (status === 402) return { error: "Os créditos de IA acabaram. Seguimos com a sugestão padrão." };
    if (status === 429) return { error: "A IA está ocupada agora. Seguimos com a sugestão padrão." };
    return { error: "Não foi possível usar a IA agora. Seguimos com a sugestão padrão." };
  }
}
