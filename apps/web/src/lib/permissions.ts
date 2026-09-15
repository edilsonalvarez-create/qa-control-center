// Mirrors apps/api/src/lib/permissions.ts — keep both lists in sync.

export const PERMISSION_KEYS = ["delete"] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  delete: "Eliminar",
};

type BasicUser = { permissions?: Record<string, boolean> };

/** ADMIN/QA_MANAGER/QA can create/edit/delete records; VIEWER is read-only. */
export function canEditRole(role?: string): boolean {
  return role === "ADMIN" || role === "QA_MANAGER" || role === "QA";
}

/**
 * Reads the server-computed permission map from /auth/me. Unlike module
 * visibility, ADMIN is NOT special-cased here — the "Permisos por rol" grid
 * lets an admin restrict any role, itself included, so the UI must match
 * whatever the API actually enforces (apps/api/src/lib/permissions.ts).
 */
export function hasPermission(user: BasicUser | null | undefined, key: PermissionKey): boolean {
  return Boolean(user?.permissions?.[key]);
}
