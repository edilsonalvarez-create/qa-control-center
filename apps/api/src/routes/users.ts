import type { FastifyInstance } from "fastify";
import { fail } from "../lib/http-errors.js";
import { prisma } from "../lib/prisma.js";
import { createUser, listUsers, updateUser } from "../services/user-service.js";

/** User management — creating users and assigning role + module permissions is ADMIN-only. */
export async function usersRoutes(app: FastifyInstance) {
  app.get("/api/v1/users", { preHandler: [app.authenticate, app.requireAdmin] }, async () => {
    return listUsers();
  });

  app.post("/api/v1/users", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    const actor = request.user as { sub: string };
    try {
      const user = await createUser(request.body);
      await prisma.auditLog.create({
        data: { userId: actor.sub, action: "USER_CREATE", entity: "User", entityId: user.id, payload: { email: user.email, role: user.role } },
      });
      return user;
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.patch("/api/v1/users/:id", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = request.user as { sub: string };
    try {
      const user = await updateUser(id, request.body, actor.sub);
      const { password: _password, ...safeBody } = (request.body ?? {}) as Record<string, unknown>;
      await prisma.auditLog.create({
        data: {
          userId: actor.sub,
          action: "USER_UPDATE",
          entity: "User",
          entityId: id,
          payload: { ...safeBody, passwordChanged: Boolean(_password) },
        },
      });
      return user;
    } catch (error) {
      return fail(reply, error);
    }
  });
}
