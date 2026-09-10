import {
  CaseStatus,
  DefectStatus,
  Environment,
  Prisma,
  RunStatus,
  Severity,
  TestType,
  type EvidenceType,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { parseUpload, type ParseResult } from "../parsers/index.js";
import { looksLikeCopy, mapEnvironment, mapTestType } from "../parsers/normalize.js";
import crypto from "node:crypto";
import type { ParsedCase } from "../parsers/types.js";

const TEST_TYPES = new Set(Object.values(TestType));
const ENVS = new Set(Object.values(Environment));
const CASE = new Set(Object.values(CaseStatus));
const SEV = new Set(Object.values(Severity));

function asTestType(v?: string): TestType {
  if (!v) return TestType.UNKNOWN;
  const mapped = mapTestType(v) as TestType;
  if (TEST_TYPES.has(mapped) && mapped !== TestType.UNKNOWN) return mapped;
  const u = v.toUpperCase() as TestType;
  return TEST_TYPES.has(u) ? u : TestType.UNKNOWN;
}
function asEnv(v?: string): Environment {
  if (!v) return Environment.UNKNOWN;
  const mapped = mapEnvironment(v) as Environment;
  return ENVS.has(mapped) ? mapped : Environment.UNKNOWN;
}
function asCase(v?: string): CaseStatus {
  if (!v) return CaseStatus.UNKNOWN;
  const u = v.toUpperCase() as CaseStatus;
  return CASE.has(u) ? u : CaseStatus.REQUIRES_REVIEW;
}
function asSev(v?: string): Severity {
  if (!v) return Severity.UNKNOWN;
  const u = v.toUpperCase() as Severity;
  return SEV.has(u) ? u : Severity.UNKNOWN;
}

function evidenceType(fileName: string): EvidenceType {
  const n = fileName.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp)$/.test(n)) return "SCREENSHOT";
  if (/\.(mp4|webm)$/.test(n)) return "VIDEO";
  if (/\.log$|\.txt$/.test(n)) return "LOG";
  if (n.endsWith(".pdf")) return "PDF";
  if (n.endsWith(".docx")) return "DOCX";
  if (/\.xlsx?$/.test(n)) return "EXCEL";
  if (n.endsWith(".json")) return "JSON";
  if (n.endsWith(".html")) return "HTML";
  return "OTHER";
}

export async function createPreview(opts: {
  userId: string;
  fileName: string;
  mime: string;
  buffer: Buffer;
  sourceUrl?: string;
  sourceFileId?: string;
  sourceModifiedAt?: Date;
  sourcePath?: string;
}) {
  const hash = crypto.createHash("sha256").update(opts.buffer).digest("hex");
  const parsed = await parseUpload(opts.fileName, opts.mime, opts.buffer, opts.sourcePath);

  const sourceFile = await prisma.sourceFile.create({
    data: {
      fileName: opts.fileName,
      mimeType: opts.mime,
      sourceUrl: opts.sourceUrl,
      sourceFileId: opts.sourceFileId,
      sourceModifiedAt: opts.sourceModifiedAt,
      contentHash: hash,
      sizeBytes: opts.buffer.length,
    },
  });

  const duplicates = await findDuplicates(parsed, hash, opts.fileName, opts.sourceFileId);
  const preview = buildPreview(parsed, duplicates, opts.fileName);

  const job = await prisma.importJob.create({
    data: {
      userId: opts.userId,
      sourceFileId: sourceFile.id,
      status: "PREVIEW",
      previewJson: preview as Prisma.InputJsonValue,
      warnings: parsed.warnings as Prisma.InputJsonValue,
      duplicates: {
        create: duplicates.map((d) => ({
          fingerprint: d.fingerprint,
          reason: d.reason,
          existingId: d.existingId,
          existingType: d.existingType,
          suggested: "REVIEW",
        })),
      },
    },
    include: { duplicates: true, sourceFile: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: opts.userId,
      action: "IMPORT_PREVIEW",
      entity: "ImportJob",
      entityId: job.id,
      payload: { fileName: opts.fileName, duplicateCount: duplicates.length },
    },
  });

  return job;
}

async function findDuplicates(parsed: ParseResult, hash: string, fileName: string, driveFileId?: string) {
  const out: Array<{
    fingerprint: string;
    reason: string;
    existingId?: string;
    existingType?: string;
  }> = [];

  const sameHash = await prisma.sourceFile.findMany({
    where: {
      contentHash: hash,
      ...(driveFileId ? { NOT: { sourceFileId: driveFileId } } : {}),
    },
    take: 5,
  });
  const hashHits = driveFileId ? sameHash.length > 0 : sameHash.length > 1;
  if (hashHits || looksLikeCopy(fileName)) {
    out.push({
      fingerprint: hash,
      reason: looksLikeCopy(fileName)
        ? "Filename indicates a copy of another report"
        : "Same file content hash already stored",
      existingId: sameHash[0]?.id,
      existingType: "SourceFile",
    });
  }

  for (const c of parsed.cases.slice(0, 200)) {
    if (!c.fingerprint) continue;
    const existing = await prisma.testCase.findFirst({
      where: {
        fingerprint: c.fingerprint,
        ...(driveFileId
          ? { NOT: { testRun: { sourceFile: { sourceFileId: driveFileId } } } }
          : {}),
      },
      include: { testRun: true },
    });
    if (existing) {
      out.push({
        fingerprint: c.fingerprint,
        reason: "Same project+module+title+date+version already imported",
        existingId: existing.id,
        existingType: "TestCase",
      });
    }
  }
  return out;
}

function buildPreview(
  parsed: ParseResult,
  duplicates: Array<{ fingerprint: string; reason: string }>,
  fileName: string,
) {
  const counts = {
    total: parsed.cases.length,
    passed: parsed.cases.filter((c) => c.status === "PASS").length,
    failed: parsed.cases.filter((c) => c.status === "FAIL").length,
    blocked: parsed.cases.filter((c) => c.status === "BLOCKED").length,
    skipped: parsed.cases.filter((c) => c.status === "SKIPPED").length,
    unknown: parsed.cases.filter((c) => c.status === "UNKNOWN" || c.status === "REQUIRES_REVIEW").length,
  };
  if (parsed.metrics?.totalTests && counts.total === 0) {
    Object.assign(counts, {
      total: parsed.metrics.totalTests,
      passed: parsed.metrics.passed ?? 0,
      failed: parsed.metrics.failed ?? 0,
      blocked: parsed.metrics.blocked ?? 0,
      skipped: parsed.metrics.skipped ?? 0,
    });
  }
  return {
    fileName,
    parsed,
    counts,
    catalogCount: parsed.catalog?.length ?? 0,
    duplicates,
    requiresConfirmation: duplicates.length > 0,
    mapping: parsed.headers,
  };
}

async function upsertCatalog(items?: ParseResult["catalog"]) {
  if (!items?.length) return;
  for (const item of items) {
    await prisma.catalogItem.upsert({
      where: { category_value: { category: item.category, value: item.value } },
      update: { sortOrder: item.sortOrder },
      create: { category: item.category, value: item.value, sortOrder: item.sortOrder },
    });
  }
}

async function ensureProject(name: string, product?: string) {
  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing) return existing;
  return prisma.project.create({
    data: {
      name,
      client: name === "Unknown" ? "Unknown" : name,
      product: product || (name === "SANOVA" ? "Unknown" : "HORUS Health"),
      status: name === "Unknown" || name === "SANOVA" ? "REQUIRES_REVIEW" : "ACTIVE",
      description: "Created from import. Requires review if name was inferred.",
    },
  });
}

async function persistRun(opts: {
  projectName: string;
  cases: ParsedCase[];
  parsed: ParseResult;
  job: {
    id: string;
    sourceFileId: string | null;
    sourceFile: { id: string; fileName: string; sourceUrl: string | null; contentHash: string | null } | null;
  };
  extraDefects: ParseResult["defects"];
}) {
  const { projectName, cases, parsed, job, extraDefects } = opts;
  const project = await ensureProject(projectName, cases.find((c) => c.product)?.product);
  const defaultModuleName = cases.find((c) => c.module)?.module ?? parsed.detectedModule;
  let moduleId: string | undefined;
  if (defaultModuleName) {
    const mod = await prisma.module.upsert({
      where: { projectId_name: { projectId: project.id, name: defaultModuleName } },
      update: {},
      create: { projectId: project.id, name: defaultModuleName },
    });
    moduleId = mod.id;
  }

  const passed = cases.filter((c) => c.status === "PASS").length;
  const failed = cases.filter((c) => c.status === "FAIL").length;
  const blocked = cases.filter((c) => c.status === "BLOCKED").length;
  const skipped = cases.filter((c) => c.status === "SKIPPED").length;
  const total = cases.length || (parsed.metrics?.totalTests ?? 0);
  const status: RunStatus =
    failed > 0
      ? RunStatus.FAILED
      : blocked > 0
        ? RunStatus.BLOCKED
        : passed > 0
          ? RunStatus.PASSED
          : RunStatus.UNKNOWN;

  const dateRaw = cases.find((c) => c.date)?.date ?? parsed.detectedDate;
  const execDate = dateRaw ? new Date(dateRaw) : new Date();
  const tester = cases.find((c) => c.tester)?.tester ?? parsed.detectedTester ?? "Unknown";
  const version = cases.find((c) => c.version)?.version;
  const environment = asEnv(cases.find((c) => c.environment)?.environment ?? parsed.detectedEnvironment);

  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      moduleId,
      testType: asTestType(cases.find((c) => c.type)?.type ?? parsed.testType),
      environment,
      executionDate: Number.isNaN(execDate.getTime()) ? new Date() : execDate,
      tester,
      version,
      totalTests: total,
      passed: cases.length ? passed : (parsed.metrics?.passed ?? 0),
      failed: cases.length ? failed : (parsed.metrics?.failed ?? 0),
      blocked: cases.length ? blocked : (parsed.metrics?.blocked ?? 0),
      skipped: cases.length ? skipped : (parsed.metrics?.skipped ?? 0),
      status,
      observations: parsed.observations,
      sourceFileId: job.sourceFileId,
      fingerprint: `${project.name}|${defaultModuleName ?? ""}|${job.sourceFile?.contentHash ?? ""}`,
    },
  });

  for (const c of cases) {
    let caseModuleId = moduleId;
    if (c.module) {
      const m = await prisma.module.upsert({
        where: { projectId_name: { projectId: project.id, name: c.module } },
        update: {},
        create: { projectId: project.id, name: c.module },
      });
      caseModuleId = m.id;
    }
    const created = await prisma.testCase.create({
      data: {
        testRunId: run.id,
        externalId: c.externalId,
        title: c.title,
        description: c.description,
        type: asTestType(c.type),
        priority: c.priority,
        status: asCase(c.status),
        executionDate: c.date && !Number.isNaN(new Date(c.date).getTime()) ? new Date(c.date) : run.executionDate,
        fingerprint: c.fingerprint,
        moduleName: c.module,
        product: c.product,
        functionality: c.functionality,
        level: c.level,
        automatable: c.automatable,
        tool: c.tool,
        preconditions: c.preconditions,
        testData: c.testData,
        steps: c.steps,
        expected: c.expected,
        expectedIntegration: c.expectedIntegration,
        actual: c.actual,
        environment: c.environment,
        cycle: c.cycle,
        executor: c.tester,
        reviewedBy: c.reviewedBy,
        observations: c.observations,
        evidenceUrl: c.evidenceUrl,
        requirementRef: c.requirementRef,
        release: c.version,
        sprint: c.sprint,
        severity: c.severity,
      },
    });
    if (c.status === "FAIL") {
      await prisma.defect.create({
        data: {
          testCaseId: created.id,
          testRunId: run.id,
          projectId: project.id,
          moduleId: caseModuleId,
          title: c.title,
          description: c.actual || c.description,
          severity: asSev(c.severity),
          status: DefectStatus.OPEN,
          detectedDate: run.executionDate,
        },
      });
    }
    if (c.evidenceUrl) {
      await prisma.evidence.create({
        data: {
          testRunId: run.id,
          testCaseId: created.id,
          type: "OTHER",
          fileName: "Evidencia",
          fileUrl: c.evidenceUrl,
          description: "Evidence link from matrix",
        },
      });
    }
  }

  for (const d of extraDefects) {
    const exists = await prisma.defect.findFirst({
      where: { testRunId: run.id, title: d.title },
    });
    if (!exists) {
      await prisma.defect.create({
        data: {
          testRunId: run.id,
          projectId: project.id,
          moduleId,
          title: d.title,
          description: d.description,
          severity: asSev(d.severity),
          status: DefectStatus.OPEN,
          detectedDate: run.executionDate,
        },
      });
    }
  }

  if (job.sourceFile) {
    await prisma.evidence.create({
      data: {
        testRunId: run.id,
        sourceFileId: job.sourceFile.id,
        type: evidenceType(job.sourceFile.fileName),
        fileName: job.sourceFile.fileName,
        fileUrl: job.sourceFile.sourceUrl,
        description: "Original imported file (reference, not duplicated)",
      },
    });
    const isReport = /\.(pdf|docx)$/i.test(job.sourceFile.fileName) || /informe/i.test(job.sourceFile.fileName);
    if (isReport) {
      await prisma.qaReport.create({
        data: {
          projectId: project.id,
          reportDate: run.executionDate,
          reportType: /semanal|weekly/i.test(job.sourceFile.fileName) ? "weekly" : "import",
          fileName: job.sourceFile.fileName,
          sourceUrl: job.sourceFile.sourceUrl,
          summary: parsed.observations?.slice(0, 2000),
          sourceFileId: job.sourceFile.id,
        },
      });
    }
  }

  return run;
}

export async function commitImport(jobId: string, userId: string, force = false) {
  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
    include: { sourceFile: true, duplicates: true },
  });
  if (!job || !job.previewJson) throw Object.assign(new Error("Import job not found"), { statusCode: 404 });
  if (job.status === "COMMITTED") throw Object.assign(new Error("Already committed"), { statusCode: 409 });
  if (job.duplicates.length > 0 && !force) {
    throw Object.assign(new Error("Duplicates detected. Review preview and commit with confirmDuplicates=true."), {
      statusCode: 409,
    });
  }

  const preview = job.previewJson as ReturnType<typeof buildPreview>;
  const parsed = preview.parsed as ParseResult;
  await upsertCatalog(parsed.catalog);

  const groups = new Map<string, ParsedCase[]>();
  for (const c of parsed.cases) {
    const name = c.project || parsed.detectedProject || "Unknown";
    const list = groups.get(name) ?? [];
    list.push(c);
    groups.set(name, list);
  }
  const hasNarrative =
    Boolean(parsed.metrics?.totalTests) || parsed.defects.length > 0;
  if (!groups.size && hasNarrative) {
    groups.set(parsed.detectedProject ?? "Unknown", []);
  }

  const runIds: string[] = [];
  const entries = [...groups.entries()];
  for (const [index, [projectName, cases]] of entries.entries()) {
    const extraDefects = index === 0 && !parsed.cases.length ? parsed.defects : [];
    const run = await persistRun({
      projectName,
      cases,
      parsed,
      job,
      extraDefects,
    });
    runIds.push(run.id);
  }

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "COMMITTED", committedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      userId,
      action: "IMPORT_COMMIT",
      entity: "TestRun",
      entityId: runIds[0],
      payload: { jobId: job.id, force, runIds },
    },
  });

  return { runId: runIds[0], runIds, jobId: job.id };
}
