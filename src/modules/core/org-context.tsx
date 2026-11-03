import { createContext, useContext } from "react";

export type OrgContextValue = {
  org: { id: string; name: string; slug: string; segment: string | null };
  roles: string[];
  permissions: string[];
  can: (permission: string) => boolean;
  isAdmin: boolean;
  isOwner: boolean;
};

export const OrgContext = createContext<OrgContextValue | null>(null);

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg fora de uma organização");
  return ctx;
}
