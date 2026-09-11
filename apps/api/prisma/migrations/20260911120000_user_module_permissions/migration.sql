-- Per-user module permissions for the admin "Usuarios" panel.
-- Empty array = no restriction (existing users keep full access after this migration).

ALTER TABLE "User" ADD COLUMN "allowedModules" TEXT[] NOT NULL DEFAULT '{}';
