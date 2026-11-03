import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError, fromDbError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { ASSIGNABLE_ROLES } from "./roles";

const orgInput = z.object({ organizationId: z.string().uuid() });
const roleEnum = z.enum(ASSIGNABLE_ROLES as [string, ...string[]]);
type RoleArg = "owner" | "admin" | "manager" | "collaborator" | "freelancer" | "client";

/**
 * O tenant nunca é confiado: toda chamada roda como o usuário autenticado,
 * e o banco (RLS + funções) confirma a associação antes de devolver ou gravar algo.
 */
export const getOrgContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: org, error }, { data: roles }, { data: perms }] = await Promise.all([
      supabase.from("organizations").select("id, name, slug, segment").eq("id", data.organizationId).maybeSingle(),
      supabase.from("organization_member_roles").select("role").eq("organization_id", data.organizationId).eq("user_id", userId),
      supabase.rpc("my_org_permissions", { _org: data.organizationId }),
    ]);
    if (error) throw fromDbError(error);
    if (!org) {
      logger.warn("tenant.access_denied", { userId, orgId: data.organizationId });
      throw new AppError("forbidden", "Você não tem acesso a esta organização.");
    }
    return { org, roles: (roles ?? []).map((r) => r.role), permissions: perms ?? [] };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [{ data: members, error }, { data: roles }, { data: invites }] = await Promise.all([
      supabase.from("organization_members").select("user_id, status, joined_at").eq("organization_id", data.organizationId),
      supabase.from("organization_member_roles").select("user_id, role").eq("organization_id", data.organizationId),
      supabase
        .from("organization_invitations")
        .select("id, email, role, expires_at, created_at")
        .eq("organization_id", data.organizationId)
        .is("accepted_at", null)
        .is("revoked_at", null),
    ]);
    if (error) throw fromDbError(error);
    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] };
    return {
      members: (members ?? []).map((m) => ({
        ...m,
        name: profiles?.find((p) => p.id === m.user_id)?.full_name ?? null,
        roles: (roles ?? []).filter((r) => r.user_id === m.user_id).map((r) => r.role),
      })),
      invitations: invites ?? [],
    };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    orgInput.extend({ email: z.string().trim().email().max(255), role: roleEnum }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: token, error } = await context.supabase.rpc("create_invitation", {
      _org: data.organizationId,
      _email: data.email,
      _role: data.role as RoleArg,
    });
    if (error) {
      logger.warn("invitation.create_failed", { code: error.code, userId: context.userId, orgId: data.organizationId });
      throw fromDbError(error);
    }
    return { token: token as string };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ invitationId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("revoke_invitation", { _id: data.invitationId });
    if (error) throw fromDbError(error);
    return { ok: true };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: orgId, error } = await context.supabase.rpc("accept_invitation", { _token: data.token });
    if (error) {
      logger.warn("invitation.accept_failed", { code: error.code, userId: context.userId });
      if (error.message?.includes("email_not_confirmed"))
        throw new AppError("forbidden", "Confirme seu e-mail antes de aceitar o convite.");
      throw new AppError("not_found", "Convite inválido, expirado ou destinado a outro e-mail.");
    }
    return { organizationId: orgId as string };
  });

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ userId: z.string().uuid(), role: roleEnum }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_member_role", {
      _org: data.organizationId,
      _user: data.userId,
      _role: data.role as RoleArg,
    });
    if (error) throw fromDbError(error);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => orgInput.extend({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("remove_member", { _org: data.organizationId, _user: data.userId });
    if (error) throw fromDbError(error);
    return { ok: true };
  });
