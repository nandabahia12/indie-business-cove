type Level = "debug" | "info" | "warn" | "error";

const SENSITIVE = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|email|phone|cpf|cnpj|doc/i;

/** Remove campos sensíveis antes de registrar. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function emit(level: Level, event: string, ctx?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...(redact(ctx ?? {}) as object) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}

export const logger = {
  debug: (e: string, c?: Record<string, unknown>) => emit("debug", e, c),
  info: (e: string, c?: Record<string, unknown>) => emit("info", e, c),
  warn: (e: string, c?: Record<string, unknown>) => emit("warn", e, c),
  error: (e: string, c?: Record<string, unknown>) => emit("error", e, c),
};
