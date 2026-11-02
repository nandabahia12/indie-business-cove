import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AppError, fromDbError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** Organizações das quais o usuário é membro (RLS filtra). */
export const listMyOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organizations")
      .select("id, name, slug, segment, created_at")
      .order("created_at");
    if (error) {
      logger.error("org.list_failed", { code: error.code, userId: context.userId });
      throw fromDbError(error);
    }
    return data;
  });

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(60),
  segment: z.string().trim().max(60).optional(),
});

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("create_organization", {
      _name: data.name,
      _slug: data.slug,
      _segment: data.segment,
    });
    if (error) {
      logger.warn("org.create_failed", { code: error.code, userId: context.userId });
      throw fromDbError(error);
    }
    if (!id) throw new AppError("internal", "Não foi possível criar a organização.");
    logger.info("org.created", { orgId: id, userId: context.userId });
    return { id };
  });

/** Módulos habilitados para a organização. */
export const listOrganizationModules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ organizationId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("organization_modules")
      .select("module_key, enabled, modules(name, sort_order)")
      .eq("organization_id", data.organizationId);
    if (error) throw fromDbError(error);
    return rows;
  });
