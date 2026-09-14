import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isPermissionKey, listRolePermissions, setRolePermission } from "../lib/permissions.js";

/** Role/permission grid — assigning capabilities like "delete" to roles is ADMIN-only. */
export async function permissionsRoutes(app: FastifyInstance) {
  app.get("/api/v1/permissions", { preHandler: [app.authenticate, app.requireAdmin] }, async () => {
    return listRolePermissions();
  });

  app.patch("/api/v1/permissions", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    const body = z
      .object({
        role: z.nativeEnum(Role),
        permission: z.string(),
        allowed: z.boolean(),
      })
      .safeParse(request.body);
    if (!body.success || !isPermissionKey(body.data.permission)) {
      return reply.code(400).send({ error: "Datos inválidos" });
    }
    try {
      const { role, permission, allowed } = body.data;
      const row = await setRolePermission(role, permission, allowed);
      const actor = request.user as { sub: string };
      await prisma.auditLog.create({
        data: {
          userId: actor.sub,
          action: "PERMISSION_UPDATE",
          entity: "RolePermission",
          entityId: `${role}:${permission}`,
          payload: { role, permission, allowed },
        },
      });
      return row;
    } catch (error) {
      const e = error as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message || "Error interno" });
    }
  });
}
