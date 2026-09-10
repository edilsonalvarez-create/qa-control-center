import { CaseStatus, RunStatus } from "@prisma/client";
import { mapStatus } from "../parsers/normalize.js";

/** Spanish matrix label ("Pasa"/"Falla"/"No ejecutado") -> Prisma CaseStatus. */
export function toCaseStatus(raw?: string | null): CaseStatus {
  const v = (raw ?? "").trim();
  if (!v) return CaseStatus.UNKNOWN;
  const code = mapStatus(v).toUpperCase();
  return (Object.values(CaseStatus) as string[]).includes(code)
    ? (code as CaseStatus)
    : CaseStatus.REQUIRES_REVIEW;
}

/** Roll a run's status up from its case counters (same rule as the importer). */
export function deriveRunStatus(counts: { passed: number; failed: number; blocked: number }): RunStatus {
  if (counts.failed > 0) return RunStatus.FAILED;
  if (counts.blocked > 0) return RunStatus.BLOCKED;
  if (counts.passed > 0) return RunStatus.PASSED;
  return RunStatus.UNKNOWN;
}

/** Stable key for the "container" run that holds manual cases of a project+module+cycle. */
export function manualRunFingerprint(projectId: string, moduleName?: string | null, cycle?: string | null): string {
  const mod = (moduleName ?? "").trim().toLowerCase();
  const cyc = ((cycle ?? "").trim() || "1").toLowerCase();
  return `manual|${projectId}|${mod}|${cyc}`;
}
