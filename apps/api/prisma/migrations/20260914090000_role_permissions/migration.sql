-- Per-role, per-permission toggle (e.g. "delete") an admin manages from Usuarios.
-- A role with no row falls back to the DEFAULT_ALLOWED map in lib/permissions.ts,
-- which matches today's behavior (ADMIN/QA_MANAGER/QA can delete, VIEWER cannot).

CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");
