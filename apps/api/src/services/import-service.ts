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
import { looksLikeCopy } from "../parsers/normalize.js";
import crypto from "node:crypto";

const TEST_TYPES = new Set(Object.values(TestType));
const ENVS = new Set(Object.values(Environment));
const CASE = new Set(Object.values(CaseStatus));
const SEV = new Set(Object.values(Severity));

function asTestType(v?: string): TestType {
  if (!v) return TestType.UNKNOWN;
  const u = v.toUpperCase() as TestType;
  return TEST_TYPES.has(u) ? u : TestType.UNKNOWN;
}
function asEnv(v?: string): Environment {
  if (!v) return Environment.UNKNOWN;
  const u = v.toUpperCase() as Environment;
  return ENVS.has(u) ? u : Environment.UNKNOWN;
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
}) {
  const hash = crypto.createHash("sha256").update(opts.buffer).digest("hex");
  const parsed = await parseUpload(opts.fileName, opts.mime, opts.buffer);

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
    duplicates,
    requiresConfirmation: duplicates.length > 0,
    mapping: parsed.headers,
  };
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
  const projectName = parsed.detectedProject ?? "Unknown";
  let project = await prisma.project.findUnique({ where: { name: projectName } });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: projectName,
        client: projectName === "Unknown" ? "Unknown" : projectName,
        product: projectName === "SANOVA" ? "Unknown" : "HORUS Health",
        status: projectName === "Unknown" || projectName === "SANOVA" ? "REQUIRES_REVIEW" : "ACTIVE",
        description: "Created from import. Requires review if name was inferred.",
      },
    });
  }

  let moduleId: string | undefined;
  if (parsed.detectedModule) {
    const mod = await prisma.module.upsert({
      where: { projectId_name: { projectId: project.id, name: parsed.detectedModule } },
      update: {},
      create: { projectId: project.id, name: parsed.detectedModule },
    });
    moduleId = mod.id;
  }

  const counts = preview.counts;
  const failed = counts.failed ?? 0;
  const blocked = counts.blocked ?? 0;
  const passed = counts.passed ?? 0;
  const status: RunStatus =
    failed > 0
      ? RunStatus.FAILED
      : blocked > 0
        ? RunStatus.BLOCKED
        : passed > 0
          ? RunStatus.PASSED
          : RunStatus.UNKNOWN;

  const execDate = parsed.detectedDate ? new Date(parsed.detectedDate) : new Date();

  const run = await prisma.testRun.create({
    data: {
      projectId: project.id,
      moduleId,
      testType: asTestType(parsed.testType),
      environment: asEnv(parsed.detectedEnvironment),
      executionDate: Number.isNaN(execDate.getTime()) ? new Date() : execDate,
      tester: parsed.detectedTester ?? "Unknown",
      totalTests: counts.total,
      passed: counts.passed,
      failed: counts.failed,
      blocked: counts.blocked,
      skipped: counts.skipped,
      status,
      observations: parsed.observations,
      sourceFileId: job.sourceFileId,
      fingerprint: `${project.name}|${parsed.detectedModule ?? ""}|${job.sourceFile?.contentHash ?? ""}`,
    },
  });

  for (const c of parsed.cases) {
    let caseModuleId = moduleId;
    if (c.module && c.module !== parsed.detectedModule) {
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
  }

  for (const d of parsed.defects) {
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

  await prisma.importJob.update({
    where: { id: job.id },
    data: { status: "COMMITTED", committedAt: new Date() },
  });
  await prisma.auditLog.create({
    data: {
      userId,
      action: "IMPORT_COMMIT",
      entity: "TestRun",
      entityId: run.id,
      payload: { jobId: job.id, force },
    },
  });

  return { runId: run.id, jobId: job.id };
}
