import type { FastifyInstance } from "fastify";
import { DefectStatus } from "@prisma/client";
import { z } from "zod";
import { parseFilters } from "../lib/filters.js";
import { prisma } from "../lib/prisma.js";
import {
  createCatalogItem,
  deleteCatalogItem,
  importCatalogWorkbook,
  isCatalogCategory,
  listCatalog,
  updateCatalogItem,
} from "../services/catalog-service.js";
import { getCoverage, getDashboard, runListWhere, searchAll } from "../services/query-service.js";
import {
  caseWhere,
  informativeCaseWhere,
  listableCaseWhere,
  panelCaseWhere,
} from "../lib/case-visibility.js";
import { fail } from "../lib/http-errors.js";
import { repairManualRunGrouping, updateManualCase } from "../services/matrix-service.js";
import { sanitizeQuery } from "../lib/auth.js";
import { requireModule } from "../lib/modules.js";
import { requirePermission } from "../lib/permissions.js";
import { deleteTestRun } from "../services/testrun-service.js";

export async function domainRoutes(app: FastifyInstance) {
  app.get("/api/v1/dashboard", { preHandler: [app.authenticate, requireModule("dashboard")] }, async (request) => {
    return getDashboard(parseFilters(request));
  });

  app.get("/api/v1/projects", { preHandler: [app.authenticate] }, async (request) => {
    const scope = String((request.query as { scope?: string }).scope ?? "executed");
    if (scope === "all") {
      return prisma.project.findMany({
        include: { _count: { select: { modules: true, testRuns: true } } },
        orderBy: { name: "asc" },
      });
    }
    const vis =
      scope === "informative" ? informativeCaseWhere() : scope === "panel" ? panelCaseWhere() : listableCaseWhere();
    const cases = await prisma.testCase.findMany({
      where: vis,
      select: { testRun: { select: { projectId: true } } },
    });
    const ids = [...new Set(cases.map((c) => c.testRun.projectId))];
    if (!ids.length) return [];
    return prisma.project.findMany({
      where: { id: { in: ids } },
      include: { _count: { select: { modules: true, testRuns: true } } },
      orderBy: { name: "asc" },
    });
  });

  app.get("/api/v1/modules", { preHandler: [app.authenticate] }, async (request) => {
    const f = parseFilters(request);
    const scope = String((request.query as { scope?: string }).scope ?? "executed");
    if (scope === "all") {
      return prisma.module.findMany({
        where: { projectId: f.projectId || undefined },
        include: { project: true },
        orderBy: { name: "asc" },
      });
    }
    const vis = scope === "informative" ? "informative" : scope === "panel" ? "panel" : "listable";
    const cases = await prisma.testCase.findMany({
      where: await caseWhere({ ...f, moduleId: undefined }, vis),
      select: { moduleName: true, testRun: { select: { moduleId: true } } },
    });
    const ids = [...new Set(cases.map((c) => c.testRun.moduleId).filter((id): id is string => Boolean(id)))];
    const names = [...new Set(cases.map((c) => c.moduleName).filter((n): n is string => Boolean(n)))];
    if (!ids.length && !names.length) return [];
    return prisma.module.findMany({
      where: {
        projectId: f.projectId || undefined,
        OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(names.length ? [{ name: { in: names } }] : [])],
      },
      include: { project: true },
      orderBy: { name: "asc" },
    });
  });

  app.get("/api/v1/test-runs", { preHandler: [app.authenticate, requireModule("runs")] }, async (request) => {
    const f = parseFilters(request);
    return prisma.testRun.findMany({
      where: await runListWhere(f, "panel"),
      include: { project: true, module: true, sourceFile: true, _count: { select: { testCases: true, defects: true } } },
      orderBy: { executionDate: "desc" },
    });
  });

  app.get("/api/v1/test-runs/:id", { preHandler: [app.authenticate, requireModule("runs")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const run = await prisma.testRun.findUnique({
      where: { id },
      include: {
        project: true,
        module: true,
        sourceFile: true,
        testCases: {
          where: panelCaseWhere(),
          include: { defects: { include: { evidence: true } }, evidence: true },
        },
        defects: { include: { evidence: true, testCase: true } },
        evidence: { include: { sourceFile: true } },
      },
    });
    if (!run) return reply.code(404).send({ error: "Not found" });
    return run;
  });

  app.patch(
    "/api/v1/test-runs/:id",
    { preHandler: [app.authenticate, requireModule("runs"), app.requireQa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({ goNoGo: z.enum(["GO", "NO_GO"]).nullable() })
        .safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "Invalid payload" });
      const existing = await prisma.testRun.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "Not found" });
      const run = await prisma.testRun.update({ where: { id }, data: { goNoGo: body.data.goNoGo } });
      const user = request.user as { sub: string };
      await prisma.auditLog.create({
        data: { userId: user.sub, action: "TEST_RUN_UPDATE", entity: "TestRun", entityId: id, payload: body.data },
      });
      return run;
    },
  );

  app.delete(
    "/api/v1/test-runs/:id",
    { preHandler: [app.authenticate, requireModule("runs"), requirePermission("delete")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user as { sub: string };
      try {
        return await deleteTestRun(id, user.sub);
      } catch (error) {
        const e = error as Error & { statusCode?: number };
        return reply.code(e.statusCode ?? 500).send({ error: e.message });
      }
    },
  );

  app.get("/api/v1/test-cases", { preHandler: [app.authenticate, requireModule("cases")] }, async (request) => {
    const f = parseFilters(request);
    return prisma.testCase.findMany({
      where: await caseWhere(f, "panel"),
      include: { testRun: { include: { project: true, module: true } }, defects: true, evidence: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
  });

  app.patch("/api/v1/test-cases/:id", { preHandler: [app.authenticate, requireModule("cases"), app.requireQa] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    try {
      return await updateManualCase(id, request.body, user.sub);
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.get("/api/v1/defects", { preHandler: [app.authenticate, requireModule("defects")] }, async (request) => {
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

  app.patch("/api/v1/defects/:id", { preHandler: [app.authenticate, requireModule("defects"), app.requireQa] }, async (request, reply) => {
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

  app.get("/api/v1/evidence", { preHandler: [app.authenticate, requireModule("evidence")] }, async (request) => {
    const f = parseFilters(request);
    return prisma.evidence.findMany({
      where: {
        testRun: f.projectId || f.moduleId ? { projectId: f.projectId, moduleId: f.moduleId } : undefined,
      },
      include: { sourceFile: true, testRun: { include: { project: true } }, defect: true },
      orderBy: { createdAt: "desc" },
    });
  });

  app.get("/api/v1/coverage", { preHandler: [app.authenticate, requireModule("coverage")] }, async (request) => {
    return getCoverage(parseFilters(request));
  });

  app.get("/api/v1/timeline", { preHandler: [app.authenticate, requireModule("timeline")] }, async (request) => {
    const f = parseFilters(request);
    return prisma.testRun.findMany({
      where: await runListWhere(f, "panel"),
      include: { project: true, module: true, _count: { select: { defects: true } } },
      orderBy: { executionDate: "desc" },
      take: 200,
    });
  });

  app.get("/api/v1/releases", { preHandler: [app.authenticate, requireModule("releases")] }, async (request) => {
    const f = parseFilters(request);
    return prisma.release.findMany({
      where: { projectId: f.projectId },
      include: { project: true },
      orderBy: { releaseDate: "desc" },
    });
  });

  app.get("/api/v1/reports", { preHandler: [app.authenticate, requireModule("reports")] }, async (request) => {
    const f = parseFilters(request);
    return prisma.qaReport.findMany({
      where: { projectId: f.projectId },
      include: { project: true, sourceFile: true },
      orderBy: { reportDate: "desc" },
    });
  });

  app.get("/api/v1/reports/export", { preHandler: [app.authenticate, requireModule("reports")] }, async (request, reply) => {
    const f = parseFilters(request);
    const runs = await prisma.testRun.findMany({
      where: await runListWhere(f),
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

  // Read-only for any authenticated user (not module-gated): catalog values are
  // reference data other modules' own selects/filters depend on (FilterBar,
  // Matriz QA), not sensitive data — only managing the catalog stays gated below.
  app.get("/api/v1/catalog", { preHandler: [app.authenticate] }, async () => {
    return listCatalog();
  });

  app.post("/api/v1/catalog", { preHandler: [app.authenticate, requireModule("catalog"), app.requireQa] }, async (request, reply) => {
    const body = z.object({ category: z.string(), value: z.string().min(1).max(200) }).safeParse(request.body);
    if (!body.success || !isCatalogCategory(body.data.category)) {
      return reply.code(400).send({ error: "Invalid catalog item" });
    }
    try {
      const item = await createCatalogItem(body.data.category, body.data.value);
      const user = request.user as { sub: string };
      await prisma.auditLog.create({
        data: { userId: user.sub, action: "CATALOG_CREATE", entity: "CatalogItem", entityId: item.id, payload: body.data },
      });
      return item;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.patch("/api/v1/catalog/:id", { preHandler: [app.authenticate, requireModule("catalog"), app.requireQa] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ value: z.string().min(1).max(200) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload" });
    try {
      const item = await updateCatalogItem(id, body.data.value);
      const user = request.user as { sub: string };
      await prisma.auditLog.create({
        data: { userId: user.sub, action: "CATALOG_UPDATE", entity: "CatalogItem", entityId: id, payload: body.data },
      });
      return item;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.delete("/api/v1/catalog/:id", { preHandler: [app.authenticate, requireModule("catalog"), requirePermission("delete")] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await deleteCatalogItem(id);
      const user = request.user as { sub: string };
      await prisma.auditLog.create({
        data: { userId: user.sub, action: "CATALOG_DELETE", entity: "CatalogItem", entityId: id },
      });
      return result;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.post("/api/v1/catalog/import", { preHandler: [app.authenticate, requireModule("catalog"), app.requireQa] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "File required" });
    const buffer = await file.toBuffer();
    try {
      const result = await importCatalogWorkbook(file.filename, file.mimetype, buffer);
      const user = request.user as { sub: string };
      await prisma.auditLog.create({
        data: {
          userId: user.sub,
          action: "CATALOG_IMPORT",
          entity: "CatalogItem",
          payload: { fileName: file.filename, upserted: result.upserted },
        },
      });
      return result;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  // On-demand version of the boot-time repair (see index.ts): lets an admin
  // verify/re-run it immediately from Settings instead of waiting for the
  // next deploy, and surfaces exactly what moved or failed.
  app.post("/api/v1/admin/repair-manual-runs", { preHandler: [app.authenticate, app.requireAdmin] }, async (request) => {
    const result = await repairManualRunGrouping();
    const user = request.user as { sub: string };
    await prisma.auditLog.create({
      data: { userId: user.sub, action: "REPAIR_MANUAL_RUNS", entity: "TestRun", payload: result },
    });
    return result;
  });
}
