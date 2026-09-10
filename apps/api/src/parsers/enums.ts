import { CaseStatus, Environment, Severity, TestType } from "@prisma/client";
import { mapEnvironment, mapTestType } from "./normalize.js";

const TEST_TYPES = new Set(Object.values(TestType));
const ENVS = new Set(Object.values(Environment));
const CASE = new Set(Object.values(CaseStatus));
const SEV = new Set(Object.values(Severity));

/** Free-text (Spanish or English) -> Prisma TestType enum. */
export function asTestType(v?: string): TestType {
  if (!v) return TestType.UNKNOWN;
  const mapped = mapTestType(v) as TestType;
  if (TEST_TYPES.has(mapped) && mapped !== TestType.UNKNOWN) return mapped;
  const u = v.toUpperCase() as TestType;
  return TEST_TYPES.has(u) ? u : TestType.UNKNOWN;
}

/** Free-text -> Prisma Environment enum. */
export function asEnv(v?: string): Environment {
  if (!v) return Environment.UNKNOWN;
  const mapped = mapEnvironment(v) as Environment;
  return ENVS.has(mapped) ? mapped : Environment.UNKNOWN;
}

/**
 * Free-text -> Prisma CaseStatus enum. Expects the already-normalized codes
 * (PASS/FAIL/BLOCKED/SKIPPED/UNKNOWN) that `mapStatus` emits; run raw Spanish
 * ("Pasa", "Falla") through `mapStatus` first.
 */
export function asCase(v?: string): CaseStatus {
  if (!v) return CaseStatus.UNKNOWN;
  const u = v.toUpperCase() as CaseStatus;
  return CASE.has(u) ? u : CaseStatus.REQUIRES_REVIEW;
}

/** Free-text -> Prisma Severity enum. Run raw Spanish through `mapSeverity` first. */
export function asSev(v?: string): Severity {
  if (!v) return Severity.UNKNOWN;
  const u = v.toUpperCase() as Severity;
  return SEV.has(u) ? u : Severity.UNKNOWN;
}
