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

/** Cases of a run that were loaded but never executed (not P/F/B/S). */
export function pendingCount(c: { total: number; passed: number; failed: number; blocked: number; skipped?: number }): number {
  return Math.max(0, c.total - c.passed - c.failed - c.blocked - (c.skipped ?? 0));
}

/**
 * Roll a run's status up from its case counters (same rule as the importer).
 * A Failed case always wins (the run failed, whatever else is missing). Short of
 * that, any pending case makes the WHOLE run PENDING: a run that could not be
 * fully evidenced must not read as Blocked/Passed.
 */
export function deriveRunStatus(counts: { passed: number; failed: number; blocked: number; pending?: number }): RunStatus {
  if (counts.failed > 0) return RunStatus.FAILED;
  if ((counts.pending ?? 0) > 0) return RunStatus.PENDING;
  if (counts.blocked > 0) return RunStatus.BLOCKED;
  if (counts.passed > 0) return RunStatus.PASSED;
  return RunStatus.UNKNOWN;
}

/**
 * Hand-entered Matriz QA rows live on a reusable MANUAL container run.
 * Imported Excel rows stay on their original import run so a field edit
 * does not move them (or their siblings) into a different container.
 */
export function usesManualRunContainer(origin: string): boolean {
  return origin === "MANUAL";
}

/**
 * True only when the QA typed a real batch label. Blank and the legacy
 * default `"1"` (old manualRunFingerprint filled that in) are NOT a cycle:
 * they used to glue every Historia Clínica case into one Test Run.
 */
export function isExplicitCycle(cycle?: string | null): boolean {
  const cyc = (cycle ?? "").trim().toLowerCase();
  return Boolean(cyc) && cyc !== "1";
}

/**
 * Stable key for the "container" run a manual case belongs to.
 *
 * When the QA sets an explicit `cycle` (e.g. "Sprint 24"), that's a deliberate
 * signal to batch several cases into one execution — group by project+module+
 * cycle as before. Without one, cases must NOT be merged just for sharing a
 * module: two cases can test completely different things (GerdQ vs PHQ-4)
 * while both living under "Historia Clínica". Each such case gets its own
 * run, keyed by its own identity (externalId, falling back to its title) so
 * re-editing the same case still resolves to the same run instead of
 * spawning a new one every time.
 */
export function manualRunFingerprint(
  projectId: string,
  moduleName?: string | null,
  cycle?: string | null,
  caseIdentity?: string | null,
): string {
  const mod = (moduleName ?? "").trim().toLowerCase();
  if (isExplicitCycle(cycle)) {
    return `manual|${projectId}|${mod}|cycle:${(cycle ?? "").trim().toLowerCase()}`;
  }
  const identity = (caseIdentity ?? "").trim().toLowerCase();
  return `manual|${projectId}|${mod}|case:${identity}`;
}
