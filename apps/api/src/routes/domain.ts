import type { FastifyInstance } from "fastify";
import { DefectStatus } from "@prisma/client";
import { z } from "zod";
import { parseFilters } from "../lib/filters.js";
import { prisma } from "../lib/prisma.js";
import { getCoverage, getDashboard, runWhere, searchAll } from "../services/query-service.js";
import { sanitizeQuery } from "../lib/auth.js";

export async function domainRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: [app.authenticate] }, async (request) => {
    return getDashboard(parseFilters(request));
  });

  app.get("/api/v1/projects", { preHandler: [app.authenticate] }, async () => {
    return prisma.project.findMany({ include: { _count: { select: { modules: true, testRuns: true } } }, orderBy: { name: "asc" } });
  });

  app.get("/api/v1/modules", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.module.findMany({
      where: { projectId: f.projectId },
      include: { project: true },
      orderBy: { name: "asc" },
    });
  });

  app.get("/api/v1/test-runs", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.testRun.findMany({
      where: runWhere(f),
      include: { project: true, module: true, sourceFile: true, _count: { select: { testCases: true, defects: true } } },
      orderBy: { executionDate: "desc" },
    });
  });

  app.get("/api/v1/test-runs/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await prisma.testRun.findUnique({
      where: { id },
      include: {
        project: true,
        module: true,
        sourceFile: true,
        testCases: { include: { defects: { include: { evidence: true } }, evidence: true } },
        defects: { include: { evidence: true, testCase: true } },
        evidence: { include: { sourceFile: true } },
      },
    });
    if (!run) return reply.code(404).send({ error: "Not found" });
    return run;
  });

  app.get("/api/v1/test-cases", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.testCase.findMany({
      where: {
        status: f.result as never,
        testRun: runWhere(f),
      },
      include: { testRun: { include: { project: true, module: true } }, defects: true },
      orderBy: { title: "asc" },
      take: 500,
    });
  });

  app.get("/api/v1/defects", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    const q = request.query as { status?: string };
    return prisma.defect.findMany({
      where: {
        projectId: f.projectId,
        moduleId: f.moduleId,
        severity: f.severity as never,
        status: q.status as never,
      },
      include: { project: true, module: true, testRun: true, testCase: true, evidence: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.patch("/api/v1/defects/:id", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z
      .object({
        status: z.nativeEnum(DefectStatus).optional(),
        assignedTo: z.string().optional(),
        resolution: z.string().optional(),
      })
      .safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload" });
    const defect = await prisma.defect.update({ where: { id }, data: body.data });
    const user = request.user as { sub: string };
    await prisma.auditLog.create({
      data: { userId: user.sub, action: "DEFECT_UPDATE", entity: "Defect", entityId: id, payload: body.data },
    });
    return defect;
  });

  app.get("/api/v1/evidence", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.evidence.findMany({
      where: {
        testRun: f.projectId || f.moduleId ? { projectId: f.projectId, moduleId: f.moduleId } : undefined,
      },
      include: { sourceFile: true, testRun: { include: { project: true } }, defect: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/api/v1/coverage", { preHandler: [app.authenticate] }, async (request) => {
    return getCoverage(parseFilters(request));
  });

  app.get("/api/v1/timeline", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.testRun.findMany({
      where: runWhere(f),
      include: { project: true, module: true, _count: { select: { defects: true } } },
      orderBy: { executionDate: "desc" },
      take: 200,
    });
  });

  app.get("/api/v1/releases", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.release.findMany({
      where: { projectId: f.projectId },
      include: { project: true },
      orderBy: { releaseDate: "desc" },
    });
  });

  app.get("/api/v1/reports", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    return prisma.qaReport.findMany({
      where: { projectId: f.projectId },
      include: { project: true, sourceFile: true },
      orderBy: { reportDate: "desc" },
    });
  });

  app.get("/api/v1/reports/export", { preHandler: [app.authenticate] }, async (request, reply) => {
    const f = parseFilters(request);
    const runs = await prisma.testRun.findMany({
      where: runWhere(f),
      include: { project: true, module: true },
      orderBy: { executionDate: "desc" },
    });
    const header = "project,module,date,type,env,tester,total,passed,failed,blocked,skipped,status";
    const lines = runs.map((r) =>
      [
        r.project.name,
        r.module?.name ?? "",
        r.executionDate.toISOString().slice(0, 10),
        r.testType,
        r.environment,
        r.tester ?? "",
        r.totalTests,
        r.passed,
        r.failed,
        r.blocked,
        r.skipped,
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=qa-report.csv");
    return [header, ...lines].join("\n");
  });

  app.get("/api/v1/search", { preHandler: [app.authenticate] }, async (request) => {
    const q = sanitizeQuery(String((request.query as { q?: string }).q ?? ""));
    return searchAll(q);
  });

  app.get("/api/v1/source-files", { preHandler: [app.authenticate] }, async () => {
    return prisma.sourceFile.findMany({ include: { project: true }, orderBy: { createdAt: "desc" } });
  });

  app.get("/api/v1/catalog", { preHandler: [app.authenticate] }, async () => {
    return prisma.catalogItem.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { value: "asc" }] });
  });
}
