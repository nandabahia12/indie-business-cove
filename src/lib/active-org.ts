// Guarda apenas a preferência de qual organização abrir. Nunca é usada como prova de acesso:
// o servidor e o banco revalidam a associação em toda chamada.
const KEY = "active-organization-id";

export function getStoredOrgId(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeOrgId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
