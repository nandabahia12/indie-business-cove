import type { Database } from "@/integrations/supabase/types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

/** Papéis oferecidos na interface (member/viewer estão descontinuados). */
export const ROLE_LABELS: Partial<Record<OrgRole, string>> = {
  owner: "Proprietário",
  admin: "Administrador",
  manager: "Gestor",
  collaborator: "Colaborador",
  freelancer: "Freelancer",
  client: "Cliente final",
};

export const ASSIGNABLE_ROLES = Object.keys(ROLE_LABELS) as OrgRole[];

export function roleLabel(role: string) {
  return ROLE_LABELS[role as OrgRole] ?? role;
}
