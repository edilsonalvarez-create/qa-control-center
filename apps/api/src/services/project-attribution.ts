import { ProjectStatus } from "@prisma/client";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { resolveProjectName } from "../parsers/normalize.js";

async function ensureProject(name: string) {
  return prisma.project.upsert({
    where: { name },
    update: {},
    create: {
      name,
      client: name,
      product: name === "SANOVA" ? "Unknown" : "HORUS Health",
      status: name === "SANOVA" ? ProjectStatus.REQUIRES_REVIEW : ProjectStatus.ACTIVE,
      description: "Created when reassigning tests to the correct client.",
    },
  });
}

export async function repairProjectAttribution() {
  let moved = 0;
  const modules = await prisma.module.findMany({ include: { project: true } });
  for (const module of modules) {
    const target = resolveProjectName({ moduleName: module.name });
    if (!target || target === module.project.name) continue;
    const dest = await ensureProject(target);
    const destModule = await prisma.module.upsert({
      where: { projectId_name: { projectId: dest.id, name: module.name } },
      update: {},
      create: { projectId: dest.id, name: module.name },
    });
    const runs = await prisma.testRun.updateMany({
      where: { moduleId: module.id },
      data: { projectId: dest.id, moduleId: destModule.id },
    });
    const defects = await prisma.defect.updateMany({
      where: { moduleId: module.id },
      data: { projectId: dest.id, moduleId: destModule.id },
    });
    moved += runs.count + defects.count;
    const leftover = await prisma.testRun.count({ where: { moduleId: module.id } });
    if (!leftover && destModule.id !== module.id) {
      await prisma.module.delete({ where: { id: module.id } }).catch(() => undefined);
    }
    logger.info(
      { module: module.name, from: module.project.name, to: target, runs: runs.count, defects: defects.count },
      "reassigned module to the correct client",
    );
  }

  const runs = await prisma.testRun.findMany({
    include: { project: true, module: true, sourceFile: true, testCases: { select: { moduleName: true } } },
  });
  for (const run of runs) {
    const moduleName = run.module?.name ?? run.testCases.find((c) => c.moduleName)?.moduleName ?? undefined;
    const target = resolveProjectName({
      fileName: run.sourceFile?.fileName ?? undefined,
      moduleName,
    });
    if (!target || target === run.project.name) continue;
    const dest = await ensureProject(target);
    const destName = moduleName;
    let moduleId: string | undefined = run.moduleId ?? undefined;
    if (destName) {
      const destModule = await prisma.module.upsert({
        where: { projectId_name: { projectId: dest.id, name: destName } },
        update: {},
        create: { projectId: dest.id, name: destName },
      });
      moduleId = destModule.id;
    }
    await prisma.testRun.update({ where: { id: run.id }, data: { projectId: dest.id, moduleId } });
    await prisma.defect.updateMany({ where: { testRunId: run.id }, data: { projectId: dest.id, moduleId } });
    if (run.sourceFileId) {
      await prisma.sourceFile.update({ where: { id: run.sourceFileId }, data: { projectId: dest.id } });
    }
    moved += 1;
    logger.info({ runId: run.id, from: run.project.name, to: target }, "reassigned test run to the correct client");
  }

  return moved;
}
