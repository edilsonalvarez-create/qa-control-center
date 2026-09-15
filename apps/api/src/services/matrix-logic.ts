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

/**
 * Hand-entered Matriz QA rows live on a reusable MANUAL container run.
 * Imported Excel rows stay on their original import run so a field edit
 * does not move them (or their siblings) into a different container.
 */
export function usesManualRunContainer(origin: string): boolean {
  return origin === "MANUAL";
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
  const cyc = (cycle ?? "").trim().toLowerCase();
  if (cyc) return `manual|${projectId}|${mod}|cycle:${cyc}`;
  const identity = (caseIdentity ?? "").trim().toLowerCase();
  return `manual|${projectId}|${mod}|case:${identity}`;
}
