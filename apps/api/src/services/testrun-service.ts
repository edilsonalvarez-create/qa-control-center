import { prisma } from "../lib/prisma.js";

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

/**
 * Deletes a TestRun and everything that only makes sense in its context.
 * `TestCase` cascades at the DB level (ON DELETE CASCADE), but Defect and
 * Evidence use ON DELETE SET NULL — left alone they'd survive as orphans
 * with no run/case/project context and keep showing up (blank) in the
 * Defects/Evidence panels. Delete them explicitly so a removed run
 * disappears everywhere: Dashboard, Coverage, Defects, Evidence, Timeline.
 */
export async function deleteTestRun(id: string, userId: string) {
  const run = await prisma.testRun.findUnique({ where: { id } });
  if (!run) throw err("Test run no encontrado", 404);

  await prisma.evidence.deleteMany({
    where: { OR: [{ testRunId: id }, { testCase: { testRunId: id } }] },
  });
  await prisma.defect.deleteMany({
    where: { OR: [{ testRunId: id }, { testCase: { testRunId: id } }] },
  });
  await prisma.testRun.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId,
      action: "TEST_RUN_DELETE",
      entity: "TestRun",
      entityId: id,
      payload: { projectId: run.projectId, moduleId: run.moduleId, executionDate: run.executionDate },
    },
  });
  return { ok: true, id };
}
