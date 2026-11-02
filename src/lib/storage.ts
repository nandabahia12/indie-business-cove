export const ORG_FILES_BUCKET = "org-files";

/** Caminho obrigatório: {organizationId}/{escopo}/{arquivo}. As regras de acesso dependem do 1º segmento. */
export function orgFilePath(organizationId: string, scope: string, fileName: string) {
  const safe = fileName.normalize("NFKD").replace(/[^\w.-]+/g, "_");
  return `${organizationId}/${scope}/${crypto.randomUUID()}-${safe}`;
}
