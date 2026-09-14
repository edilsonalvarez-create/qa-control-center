import type { FastifyReply, FastifyRequest } from "fastify";
import { Role } from "@prisma/client";
import { prisma } from "./prisma.js";

/**
 * Fine-grained capabilities an admin can grant to one or more roles from the
 * Usuarios page, independent of the coarser per-route Role gates
 * (app.requireQa / app.requireAdmin). Extend this list to add more.
 */
export const PERMISSION_KEYS = ["delete"] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  delete: "Eliminar",
};

export const ROLES: Role[] = [Role.ADMIN, Role.QA_MANAGER, Role.QA, Role.VIEWER];

/** Behavior before any admin ever touches the RolePermission table. */
export const DEFAULT_ALLOWED: Record<PermissionKey, Role[]> = {
  delete: [Role.ADMIN, Role.QA_MANAGER, Role.QA],
};

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export type RolePermissionRow = { role: Role; permission: PermissionKey; allowed: boolean };

export async function listRolePermissions(): Promise<RolePermissionRow[]> {
  const rows = await prisma.rolePermission.findMany();
  const overrides = new Map(rows.map((r) => [`${r.role}|${r.permission}`, r.allowed]));
  return PERMISSION_KEYS.flatMap((permission) =>
    ROLES.map((role) => ({
      role,
      permission,
      allowed: overrides.get(`${role}|${permission}`) ?? DEFAULT_ALLOWED[permission].includes(role),
    })),
  );
}

export async function isPermissionAllowed(role: Role, permission: PermissionKey): Promise<boolean> {
  const row = await prisma.rolePermission.findUnique({
    where: { role_permission: { role, permission } },
  });
  if (row) return row.allowed;
  return DEFAULT_ALLOWED[permission].includes(role);
}

/** All permission keys resolved for one role — sent to the client (auth.ts) so the
 * UI knows what to show without every user needing the ADMIN-only /permissions route. */
export async function permissionsForRole(role: Role): Promise<Record<PermissionKey, boolean>> {
  const entries = await Promise.all(
    PERMISSION_KEYS.map(async (key) => [key, await isPermissionAllowed(role, key)] as const),
  );
  return Object.fromEntries(entries) as Record<PermissionKey, boolean>;
}

/** Toggle one role/permission cell. Refuses to leave a permission with zero roles granted. */
export async function setRolePermission(role: Role, permission: PermissionKey, allowed: boolean) {
  if (!allowed) {
    const current = await listRolePermissions();
    const stillGranted = current.some((r) => r.permission === permission && r.role !== role && r.allowed);
    if (!stillGranted) {
      throw err(`Debe quedar al menos un rol con el permiso "${PERMISSION_LABELS[permission]}"`, 409);
    }
  }
  return prisma.rolePermission.upsert({
    where: { role_permission: { role, permission } },
    update: { allowed },
    create: { role, permission, allowed },
  });
}

/** Route preHandler that 403s unless the caller's role currently has `permission`. */
export function requirePermission(permission: PermissionKey) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = request.user as { role: Role };
    const allowed = await isPermissionAllowed(payload.role, permission);
    if (!allowed) {
      return reply.code(403).send({ error: `Tu rol no tiene el permiso "${PERMISSION_LABELS[permission]}"` });
    }
  };
}
