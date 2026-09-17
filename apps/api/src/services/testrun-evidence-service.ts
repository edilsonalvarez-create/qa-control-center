import { prisma } from "../lib/prisma.js";
import { parseGoogleSheet } from "./evidence-parser-service.js";

const RUN_INCLUDE = {
  project: true,
  module: true,
  sourceFile: true,
  _count: { select: { testCases: true, defects: true } },
} as const;

export async function syncTestRunFromSheet(testRunId: string, evidenceUrl: string) {
  const counts = await parseGoogleSheet(evidenceUrl);

  return prisma.testRun.update({
    where: { id: testRunId },
    data: {
      evidenceUrl,
      totalTests: counts.total,
      passed: counts.passed,
      failed: counts.failed,
      blocked: counts.blocked,
      skipped: counts.skipped,
      status: runStatus(counts),
    },
    include: RUN_INCLUDE,
  });
}

function runStatus(c: { total: number; passed: number; failed: number; blocked: number; pending: number }) {
  if (c.failed > 0) return "FAILED" as const;
  if (c.blocked > 0) return "BLOCKED" as const;
  if (c.pending > 0) return "IN_PROGRESS" as const;
  if (c.passed > 0) return "PASSED" as const;
  return "UNKNOWN" as const;
}
