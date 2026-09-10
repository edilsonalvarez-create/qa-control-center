import { CaseStatus, DefectStatus, Prisma, RunStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asEnv, asSev, asTestType } from "../parsers/enums.js";
import { mapSeverity } from "../parsers/normalize.js";
import { deriveRunStatus, manualRunFingerprint, toCaseStatus } from "./matrix-logic.js";
import { commitImport, createPreview } from "./import-service.js";
import type { FilterQuery } from "../lib/filters.js";

/**
 * "Matriz QA" module: lets QA register / edit / delete test cases by hand and
 * upload the standard matrix workbook. Everything is written into the same
 * TestCase / TestRun / Defect tables the dashboards already aggregate from, so
 * the other panels update automatically. Only rows with origin === "MANUAL"
 * can be edited or deleted here; imported rows are read-only.
 */

const caseInclude = {
  testRun: { include: { project: true, module: true } },
  defects: true,
} satisfies Prisma.TestCaseInclude;

/** Nullable free-text columns copied verbatim from the matrix. */
const STRING_FIELDS = [
  "externalId",
  "product",
  "release",
  "sprint",
  "requirementRef",
  "moduleName",
  "functionality",
  "level",
  "priority",
  "automatable",
  "tool",
  "preconditions",
  "testData",
  "steps",
  "expected",
  "expectedIntegration",
  "environment",
  "executor",
  "cycle",
  "actual",
  "severity",
  "defectRef",
  "evidenceUrl",
  "observations",
  "reviewedBy",
] as const;

const caseInput = z.object({
  projectId: z.string().min(1, "Proyecto requerido"),
  title: z.string().trim().min(1, "Título requerido").max(500),
  externalId: z.string().trim().max(120).optional(),
  product: z.string().trim().max(200).optional(),
  release: z.string().trim().max(200).optional(),
  sprint: z.string().trim().max(200).optional(),
  requirementRef: z.string().trim().max(200).optional(),
  moduleName: z.string().trim().max(200).optional(),
  functionality: z.string().trim().max(300).optional(),
  type: z.string().trim().max(80).optional(),
  level: z.string().trim().max(80).optional(),
  priority: z.string().trim().max(80).optional(),
  automatable: z.string().trim().max(80).optional(),
  tool: z.string().trim().max(120).optional(),
  preconditions: z.string().max(4000).optional(),
  testData: z.string().max(4000).optional(),
  steps: z.string().max(8000).optional(),
  expected: z.string().max(4000).optional(),
  expectedIntegration: z.string().max(4000).optional(),
  environment: z.string().trim().max(80).optional(),
  executionDate: z.string().trim().max(40).optional(),
  executor: z.string().trim().max(200).optional(),
  cycle: z.string().trim().max(80).optional(),
  actual: z.string().max(4000).optional(),
  status: z.string().trim().max(80).optional(),
  severity: z.string().trim().max(80).optional(),
  defectRef: z.string().trim().max(120).optional(),
  evidenceUrl: z.string().trim().max(1000).optional(),
  observations: z.string().max(4000).optional(),
  reviewedBy: z.string().trim().max(200).optional(),
});

type CaseInput = z.infer<typeof caseInput>;

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function clean(value?: string): string | null {
  const v = (value ?? "").trim();
  return v ? v : null;
}

function parseDate(raw?: string): Date | null {
  const v = clean(raw);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Build the shared TestCase column payload from validated input. */
function caseData(input: Partial<CaseInput>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const field of STRING_FIELDS) {
    if (input[field] !== undefined) data[field] = clean(input[field]);
  }
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.status !== undefined) data.status = toCaseStatus(input.status);
  if (input.type !== undefined) data.type = asTestType(input.type);
  if (input.executionDate !== undefined) data.executionDate = parseDate(input.executionDate);
  return data;
}

async function assertProject(projectId: string) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw err("Proyecto no encontrado", 400);
  return project;
}

/**
 * One "container" TestRun per project + module + cycle for manual cases.
 * Reused across writes so the matrix does not spawn a run per case.
 */
async function ensureManualRun(opts: {
  projectId: string;
  moduleName?: string | null;
  cycle?: string | null;
  type?: string | null;
  environment?: string | null;
  executor?: string | null;
}): Promise<{ id: string; projectId: string; moduleId: string | null }> {
  const project = await assertProject(opts.projectId);
  const moduleName = clean(opts.moduleName ?? undefined);
  let moduleId: string | null = null;
  if (moduleName) {
    const mod = await prisma.module.upsert({
      where: { projectId_name: { projectId: project.id, name: moduleName } },
      update: {},
      create: { projectId: project.id, name: moduleName },
    });
    moduleId = mod.id;
  }
  const fingerprint = manualRunFingerprint(project.id, moduleName, opts.cycle);
  const existing = await prisma.testRun.findFirst({ where: { fingerprint, origin: "MANUAL" } });
  if (existing) {
    if (moduleId && existing.moduleId !== moduleId) {
      await prisma.testRun.update({ where: { id: existing.id }, data: { moduleId } });
    }
    return { id: existing.id, projectId: project.id, moduleId: moduleId ?? existing.moduleId };
  }
  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      moduleId,
      testType: asTestType(opts.type ?? undefined),
      environment: asEnv(opts.environment ?? undefined),
      executionDate: new Date(),
      tester: clean(opts.executor ?? undefined),
      status: RunStatus.UNKNOWN,
      observations: "Registro manual — Matriz QA",
      origin: "MANUAL",
      fingerprint,
    },
  });
  return { id: run.id, projectId: project.id, moduleId };
}

/** Recompute a run's counters/status from its cases; drop empty manual runs. */
async function recomputeRun(runId: string) {
  const run = await prisma.testRun.findUnique({ where: { id: runId }, include: { testCases: true } });
  if (!run) return;
  const cases = run.testCases;
  if (!cases.length && run.origin === "MANUAL") {
    await prisma.defect.updateMany({ where: { testRunId: runId }, data: { testRunId: null } });
    await prisma.evidence.updateMany({ where: { testRunId: runId }, data: { testRunId: null } });
    await prisma.testRun.delete({ where: { id: runId } });
    return;
  }
  const count = (s: CaseStatus) => cases.filter((c) => c.status === s).length;
  const passed = count(CaseStatus.PASS);
  const failed = count(CaseStatus.FAIL);
  const blocked = count(CaseStatus.BLOCKED);
  const skipped = count(CaseStatus.SKIPPED);
  const status = deriveRunStatus({ passed, failed, blocked });
  const dates = cases.map((c) => c.executionDate).filter((d): d is Date => Boolean(d));
  const executionDate = dates.length
    ? new Date(Math.max(...dates.map((d) => d.getTime())))
    : run.executionDate;
  await prisma.testRun.update({
    where: { id: runId },
    data: {
      totalTests: cases.length,
      passed,
      failed,
      blocked,
      skipped,
      status,
      executionDate,
      tester: cases.find((c) => c.executor)?.executor ?? run.tester,
      version: cases.find((c) => c.release)?.release ?? run.version,
    },
  });
}

/** Keep an auto-defect in sync with a FAIL case (mirrors the import behaviour). */
async function syncCaseDefect(tc: {
  id: string;
  status: CaseStatus;
  title: string;
  actual: string | null;
  description: string | null;
  severity: string | null;
  executionDate: Date | null;
  defectRef: string | null;
  testRunId: string;
  projectId: string;
  moduleId: string | null;
}) {
  const auto = await prisma.defect.findFirst({ where: { testCaseId: tc.id, origin: "MANUAL_AUTO" } });
  if (tc.status === CaseStatus.FAIL) {
    const data = {
      testRunId: tc.testRunId,
      projectId: tc.projectId,
      moduleId: tc.moduleId,
      title: tc.defectRef ? `${tc.defectRef} — ${tc.title}` : tc.title,
      description: tc.actual || tc.description,
      severity: asSev(mapSeverity(tc.severity ?? undefined)),
      detectedDate: tc.executionDate ?? new Date(),
      origin: "MANUAL_AUTO",
    };
    if (auto) await prisma.defect.update({ where: { id: auto.id }, data });
    else await prisma.defect.create({ data: { ...data, testCaseId: tc.id, status: DefectStatus.OPEN } });
  } else if (auto) {
    await prisma.defect.delete({ where: { id: auto.id } });
  }
}

export async function listMatrixCases(f: FilterQuery & { origin?: string }) {
  const and: Prisma.TestCaseWhereInput[] = [];
  if (f.origin) and.push({ origin: f.origin });
  if (f.projectId) and.push({ testRun: { projectId: f.projectId } });
  if (f.moduleId) {
    const mod = await prisma.module.findUnique({ where: { id: f.moduleId }, select: { name: true } });
    const or: Prisma.TestCaseWhereInput[] = [{ testRun: { moduleId: f.moduleId } }];
    if (mod?.name) or.push({ moduleName: mod.name });
    and.push({ OR: or });
  }
  return prisma.testCase.findMany({
    where: and.length ? { AND: and } : {},
    include: caseInclude,
    orderBy: [{ createdAt: "desc" }],
    take: 1000,
  });
}

export async function listAllProjects() {
  return prisma.project.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, client: true, product: true, status: true },
  });
}

export async function createManualCase(raw: unknown, userId: string) {
  const input = caseInput.parse(raw);
  const project = await assertProject(input.projectId);
  const run = await ensureManualRun({
    projectId: input.projectId,
    moduleName: input.moduleName,
    cycle: input.cycle,
    type: input.type,
    environment: input.environment,
    executor: input.executor,
  });

  const created = await prisma.testCase.create({
    data: {
      ...caseData(input),
      testRunId: run.id,
      title: input.title.trim(),
      origin: "MANUAL",
      status: toCaseStatus(input.status),
      type: asTestType(input.type),
      executionDate: parseDate(input.executionDate),
      fingerprint: `manual|${project.name}|${input.moduleName ?? ""}|${input.title}|${input.executionDate ?? ""}`
        .toLowerCase()
        .replace(/\s+/g, " "),
    } as Prisma.TestCaseUncheckedCreateInput,
  });

  await syncCaseDefect({ ...created, projectId: run.projectId, moduleId: run.moduleId });
  if (created.evidenceUrl) {
    await prisma.evidence.create({
      data: {
        testRunId: run.id,
        testCaseId: created.id,
        type: "OTHER",
        fileName: "Evidencia",
        fileUrl: created.evidenceUrl,
        description: "Enlace de evidencia (Matriz QA)",
      },
    });
  }
  await recomputeRun(run.id);
  await prisma.auditLog.create({
    data: {
      userId,
      action: "MATRIX_CASE_CREATE",
      entity: "TestCase",
      entityId: created.id,
      payload: { title: created.title, projectId: input.projectId },
    },
  });
  return prisma.testCase.findUnique({ where: { id: created.id }, include: caseInclude });
}

export async function updateManualCase(id: string, raw: unknown, userId: string) {
  const existing = await prisma.testCase.findUnique({ where: { id }, include: { testRun: true } });
  if (!existing) throw err("Caso no encontrado", 404);
  if (existing.origin !== "MANUAL") {
    throw err("Solo se pueden editar los casos creados manualmente en Matriz QA", 403);
  }
  const input = caseInput.partial().parse(raw);

  const projectId = input.projectId ?? existing.testRun.projectId;
  const moduleName = input.moduleName !== undefined ? input.moduleName : existing.moduleName;
  const cycle = input.cycle !== undefined ? input.cycle : existing.cycle;
  const oldRunId = existing.testRunId;
  const run = await ensureManualRun({
    projectId,
    moduleName,
    cycle,
    type: input.type ?? existing.type,
    environment: input.environment ?? existing.environment,
    executor: input.executor ?? existing.executor,
  });

  const data = caseData(input) as Prisma.TestCaseUncheckedUpdateInput;
  if (run.id !== oldRunId) data.testRunId = run.id;

  const updated = await prisma.testCase.update({ where: { id }, data });
  await syncCaseDefect({ ...updated, projectId: run.projectId, moduleId: run.moduleId });
  await recomputeRun(run.id);
  if (run.id !== oldRunId) await recomputeRun(oldRunId);
  await prisma.auditLog.create({
    data: {
      userId,
      action: "MATRIX_CASE_UPDATE",
      entity: "TestCase",
      entityId: id,
      payload: { fields: Object.keys(input) },
    },
  });
  return prisma.testCase.findUnique({ where: { id }, include: caseInclude });
}

export async function deleteManualCase(id: string, userId: string) {
  const existing = await prisma.testCase.findUnique({ where: { id } });
  if (!existing) throw err("Caso no encontrado", 404);
  if (existing.origin !== "MANUAL") {
    throw err("Solo se pueden eliminar los casos creados manualmente en Matriz QA", 403);
  }
  await prisma.defect.deleteMany({ where: { testCaseId: id, origin: "MANUAL_AUTO" } });
  await prisma.defect.updateMany({ where: { testCaseId: id }, data: { testCaseId: null } });
  await prisma.evidence.deleteMany({ where: { testCaseId: id } });
  const runId = existing.testRunId;
  await prisma.testCase.delete({ where: { id } });
  await recomputeRun(runId);
  await prisma.auditLog.create({
    data: { userId, action: "MATRIX_CASE_DELETE", entity: "TestCase", entityId: id },
  });
  return { ok: true, id };
}

export async function importMatrixWorkbook(opts: {
  userId: string;
  fileName: string;
  mime: string;
  buffer: Buffer;
}) {
  const job = await createPreview({
    userId: opts.userId,
    fileName: opts.fileName,
    mime: opts.mime,
    buffer: opts.buffer,
  });
  const preview = (job.previewJson ?? {}) as { counts?: { total?: number }; catalogCount?: number };
  const total = preview.counts?.total ?? 0;
  if (total === 0 && !preview.catalogCount) {
    throw err(
      "No se detectaron casos en el archivo. Verifica que la hoja tenga los encabezados de la matriz estándar.",
      400,
    );
  }
  const duplicates = job.duplicates ?? [];
  if (duplicates.length === 0) {
    const result = await commitImport(job.id, opts.userId, false);
    return { committed: true, jobId: job.id, imported: total, runIds: result.runIds };
  }
  return { committed: false, jobId: job.id, duplicates };
}
