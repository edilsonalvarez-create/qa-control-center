import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Sidebar modules an admin can grant/revoke per user (see UsersPage.tsx on the
 * web side, which mirrors this list). "users" itself is not in this list —
 * managing users is always ADMIN-only, never delegated via allowedModules.
 */
export const MODULE_KEYS = [
  "dashboard",
  "runs",
  "cases",
  "matrix",
  "catalog",
  "defects",
  "coverage",
  "evidence",
  "timeline",
  "releases",
  "reports",
  "import",
  "settings",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as readonly string[]).includes(value);
}

/** Empty list = unrestricted (all modules). ADMIN always has full access. */
export function hasModuleAccess(role: Role, allowedModules: string[], key: ModuleKey): boolean {
  if (role === "ADMIN") return true;
  if (!allowedModules.length) return true;
  return allowedModules.includes(key);
}

/**
 * Route preHandler that 403s a request unless the caller's role/allowedModules
 * grant at least one of `keys`. Must run after `app.authenticate`.
 */
export function requireModule(...keys: ModuleKey[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { sub: string; role: Role };
    if (payload.role === "ADMIN") return;
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { allowedModules: true, role: true, active: true },
    });
    if (!user || !user.active) return reply.code(401).send({ error: "Unauthorized" });
    if (!keys.some((key) => hasModuleAccess(user.role, user.allowedModules, key))) {
      return reply.code(403).send({ error: "No tienes acceso a este módulo" });
    }
  };
}
