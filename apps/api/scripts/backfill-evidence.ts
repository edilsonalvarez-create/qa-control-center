import { prisma } from "../src/lib/prisma.js";

/**
 * Safety-net backfill before dropping TestCase.evidenceUrl.
 * Uses raw SQL so it still compiles after the Prisma column is gone, and is a
 * no-op if the column was already dropped. Idempotent.
 */
async function main() {
  const cols = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'TestCase'
      AND column_name = 'evidenceUrl'
  `;
  if (!cols.length) {
    console.log(JSON.stringify({ skipped: true, reason: "TestCase.evidenceUrl already dropped" }));
    return;
  }

  const cases = await prisma.$queryRaw<Array<{ id: string; testRunId: string; evidenceUrl: string }>>`
    SELECT id, "testRunId", "evidenceUrl"
    FROM "TestCase"
    WHERE "evidenceUrl" IS NOT NULL
  `;

  let created = 0;
  for (const c of cases) {
    if (!c.evidenceUrl) continue;
    const exists = await prisma.evidence.findFirst({
      where: { testCaseId: c.id, fileUrl: c.evidenceUrl },
    });
    if (exists) continue;
    await prisma.evidence.create({
      data: {
        testRunId: c.testRunId,
        testCaseId: c.id,
        type: "OTHER",
        fileName: "Evidencia",
        fileUrl: c.evidenceUrl,
        description: "Backfilled from TestCase.evidenceUrl before column removal",
      },
    });
    created += 1;
  }

  console.log(JSON.stringify({ scanned: cases.length, created }, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
