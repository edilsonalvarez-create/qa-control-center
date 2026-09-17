import { prisma } from "../lib/prisma.js";
import { parseGoogleSheetsCsv, ParsedEvidence } from "./evidence-parser-service.js";

/**
 * Update TestRun with evidence URL and parse P/F/B/S from the sheet.
 */
export async function updateTestRunWithEvidence(
  testRunId: string,
  evidenceUrl: string
): Promise<any> {
  // Validate the URL
  if (!evidenceUrl || !evidenceUrl.startsWith("http")) {
    throw new Error("Invalid evidence URL: must be a valid HTTP URL");
  }

  // Parse the Google Sheets to extract P/F/B/S
  let parsed: ParsedEvidence;
  try {
    parsed = await parseGoogleSheetsCsv(evidenceUrl);
  } catch (error) {
    throw new Error(`Failed to parse evidence from URL: ${(error as Error).message}`);
  }

  // Update the TestRun with the parsed values
  const updated = await prisma.testRun.update({
    where: { id: testRunId },
    data: {
      evidenceUrl,
      totalTests: parsed.total || parsed.passed + parsed.failed + parsed.blocked + parsed.skipped,
      passed: parsed.passed,
      failed: parsed.failed,
      blocked: parsed.blocked,
      skipped: parsed.skipped,
    },
    include: {
      project: true,
      module: true,
      sourceFile: true,
      _count: { select: { testCases: true, defects: true } },
    },
  });

  return updated;
}
