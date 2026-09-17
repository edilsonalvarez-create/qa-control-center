import { CaseStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseGoogleSheet } from "./evidence-parser-service.js";

const RUN_INCLUDE = {
  project: true,
  module: true,
  sourceFile: true,
  _count: { select: { testCases: true, defects: true } },
} as const;

interface Counts {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  pending: number;
}

export async function syncTestRunFromSheet(testRunId: string, evidenceUrl: string) {
  const counts = await parseGoogleSheet(evidenceUrl);
  return writeCounts(testRunId, evidenceUrl, counts);
}

/**
 * Drop the linked sheet and fall back to counting the run's own registered
 * cases. Needed when a run was synced against the wrong sheet: without this
 * the inflated numbers cannot be undone from the UI.
 */
export async function unlinkTestRunSheet(testRunId: string) {
  const cases = await prisma.testCase.findMany({
    where: { testRunId },
    select: { status: true },
  });

  const counts: Counts = { total: cases.length, passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
  for (const { status } of cases) {
    if (status === CaseStatus.PASS) counts.passed++;
    else if (status === CaseStatus.FAIL) counts.failed++;
    else if (status === CaseStatus.BLOCKED) counts.blocked++;
    else if (status === CaseStatus.SKIPPED) counts.skipped++;
    else counts.pending++;
  }

  return writeCounts(testRunId, null, counts);
}

function writeCounts(testRunId: string, evidenceUrl: string | null, c: Counts) {
  return prisma.testRun.update({
    where: { id: testRunId },
    data: {
      evidenceUrl,
      totalTests: c.total,
      passed: c.passed,
      failed: c.failed,
      blocked: c.blocked,
      skipped: c.skipped,
      status: runStatus(c),
    },
    include: RUN_INCLUDE,
  });
}

function runStatus(c: Counts) {
  if (c.failed > 0) return "FAILED" as const;
  if (c.blocked > 0) return "BLOCKED" as const;
  if (c.pending > 0) return "IN_PROGRESS" as const;
  if (c.passed > 0) return "PASSED" as const;
  return "UNKNOWN" as const;
}
