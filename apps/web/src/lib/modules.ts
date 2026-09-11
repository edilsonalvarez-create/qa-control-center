// Mirrors apps/api/src/lib/modules.ts — keep both lists in sync.

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

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  runs: "Test Runs",
  cases: "Test Cases",
  matrix: "Matriz QA",
  catalog: "Catálogo",
  defects: "Defects",
  coverage: "Coverage",
  evidence: "Evidence",
  timeline: "Timeline",
  releases: "Releases",
  reports: "Reports",
  import: "Import Center",
  settings: "Settings",
};

type BasicUser = { role: string; allowedModules?: string[] };

/** Empty list = unrestricted (all modules). ADMIN always has full access. */
export function hasModuleAccess(user: BasicUser | null | undefined, key: ModuleKey): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const allowed = user.allowedModules ?? [];
  return allowed.length === 0 || allowed.includes(key);
}
