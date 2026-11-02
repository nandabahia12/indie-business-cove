export type AppErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "internal";

/** Erro de aplicação com mensagem segura para o usuário final. */
export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const PG_MAP: Record<string, { code: AppErrorCode; message: string }> = {
  "23505": { code: "conflict", message: "Registro já existe." },
  "23503": { code: "validation", message: "Referência inválida." },
  "23514": { code: "validation", message: "Dados inválidos." },
  "42501": { code: "forbidden", message: "Sem permissão para esta ação." },
  "28000": { code: "unauthenticated", message: "Faça login para continuar." },
  PGRST116: { code: "not_found", message: "Registro não encontrado." },
};

/** Converte erro do banco em AppError sem expor detalhes internos. */
export function fromDbError(err: { code?: string; message?: string } | null): AppError {
  const mapped = err?.code ? PG_MAP[err.code] : undefined;
  return mapped
    ? new AppError(mapped.code, mapped.message)
    : new AppError("internal", "Não foi possível concluir a operação.");
}
