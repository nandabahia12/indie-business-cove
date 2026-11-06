import { z } from "zod";
import { AppError, fromDbError } from "@/lib/errors";

export const orgInput = z.object({ organizationId: z.string().uuid() });
export const uuid = z.string().uuid();
export const optText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

/** Mensagens levantadas pelas funções do CRM são seguras; erros internos do banco viram mensagem genérica. */
export function crmError(err: { code?: string; message?: string } | null) {
  const msg = err?.message ?? "";
  if (err?.code && ["23514", "P0002", "42501"].includes(err.code) && msg && !/constraint|violates|row-level|permission denied/i.test(msg)) {
    return new AppError(err.code === "42501" ? "forbidden" : err.code === "P0002" ? "not_found" : "validation", msg);
  }
  if (err?.code === "23503") return new AppError("conflict", "Este registro possui vínculos e não pode ser excluído. Arquive-o.");
  return fromDbError(err);
}
