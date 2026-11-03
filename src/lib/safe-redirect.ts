/** Aceita apenas caminhos internos ("/..."), nunca URLs externas. */
export function safeRedirect(value: string | null | undefined, fallback = "/app"): string {
  if (!value) return fallback;
  try {
    const url = new URL(value, "http://local");
    if (url.origin !== "http://local") {
      if (typeof window !== "undefined" && value.startsWith(window.location.origin)) {
        const u = new URL(value);
        return u.pathname + u.search;
      }
      return fallback;
    }
    if (!value.startsWith("/") || value.startsWith("//")) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
