// Mirrors apps/api/src/lib/permissions.ts — keep both lists in sync.

export const PERMISSION_KEYS = ["delete"] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  delete: "Eliminar",
};
