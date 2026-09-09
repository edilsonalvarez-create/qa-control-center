import { Prisma } from "@prisma/client";
import type { AppConfig } from "../config.js";
import {
  downloadDriveFile,
  DriveNotConnectedError,
  getDrive,
  listDriveTree,
} from "../lib/google-drive.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { commitImport, createPreview } from "./import-service.js";
import { decideDriveFile, shouldAutoCommit } from "./drive-sync-policy.js";

export type SyncTrigger = "CRON" | "MANUAL" | "HTTP" | "APPS_SCRIPT";

type FileAction = {
  fileName: string;
  path: string;
  action: "imported" | "preview" | "skipped" | "failed";
  reason: string;
  jobId?: string;
  runId?: string;
};

let inFlight: Promise<string> | null = null;

async function actorUserId() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("No active ADMIN user to attribute Drive imports");
  return admin.id;
}

export function isDriveSyncRunning() {
  return inFlight != null;
}

export async function enqueueDriveSync(config: AppConfig, trigger: SyncTrigger): Promise<{ id: string; status: string }> {
  if (inFlight) {
    const running = await prisma.driveSyncRun.findFirst({
      where: { status: "RUNNING" },
      orderBy: { startedAt: "desc" },
    });
    return { id: running?.id ?? "running", status: "RUNNING" };
  }

  const run = await prisma.driveSyncRun.create({
    data: { status: "RUNNING", trigger },
  });

  inFlight = executeDriveSync(config, run.id)
    .catch((err) => {
      logger.error({ err, runId: run.id }, "drive sync failed");
      return run.id;
    })
    .finally(() => {
      inFlight = null;
    });

  return { id: run.id, status: "RUNNING" };
}

export async function getDriveSyncStatus(config: AppConfig) {
  const last = await prisma.driveSyncRun.findFirst({ orderBy: { startedAt: "desc" } });
  const recent = await prisma.driveSyncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 10,
  });
  return {
    running: isDriveSyncRunning() || last?.status === "RUNNING",
    last,
    recent,
    schedule: {
      cron: config.DRIVE_SYNC_CRON,
      timezone: config.DRIVE_SYNC_TZ,
      enabled: config.DRIVE_SYNC_ENABLED !== "false" && config.DRIVE_SYNC_ENABLED !== "0",
    },
    pushIngestEnabled: true,
  };
}

export async function beginPushIngest(config: AppConfig, trigger: SyncTrigger = "APPS_SCRIPT") {
  const run = await prisma.driveSyncRun.create({
    data: { status: "RUNNING", trigger },
  });
  return { id: run.id, status: run.status };
}

async function hasImportedResults(driveFileId?: string) {
  if (!driveFileId) return false;
  const previous = await prisma.sourceFile.findMany({
    where: { sourceFileId: driveFileId },
    select: { id: true },
  });
  if (!previous.length) return false;
  const runs = await prisma.testRun.findMany({
    where: { sourceFileId: { in: previous.map((f) => f.id) } },
    select: { passed: true, failed: true, blocked: true },
  });
  return runs.some((r) => r.passed + r.failed + r.blocked > 0);
}

async function replacePreviousDriveRuns(driveFileId: string) {
  const previous = await prisma.sourceFile.findMany({
    where: { sourceFileId: driveFileId },
    select: { id: true },
  });
  if (!previous.length) return;
  const sourceIds = previous.map((f) => f.id);
  const runs = await prisma.testRun.findMany({
    where: { sourceFileId: { in: sourceIds } },
    select: { id: true },
  });
  const runIds = runs.map((r) => r.id);
  if (!runIds.length) return;
  await prisma.defect.deleteMany({ where: { testRunId: { in: runIds } } });
  await prisma.evidence.deleteMany({ where: { testRunId: { in: runIds } } });
  await prisma.testRun.deleteMany({ where: { id: { in: runIds } } });
}

export async function ingestPushedFile(
  config: AppConfig,
  opts: {
    runId?: string;
    fileName: string;
    mime: string;
    buffer: Buffer;
    sourceFileId?: string;
    sourceUrl?: string;
    sourceModifiedAt?: Date;
    path?: string;
    force?: boolean;
  },
) {
  const runId = opts.runId ?? (await beginPushIngest(config)).id;
  const run = await prisma.driveSyncRun.findUnique({ where: { id: runId } });
  if (!run || run.status !== "RUNNING") {
    throw Object.assign(new Error("Sync run not found or already finished"), { statusCode: 409 });
  }

  const existing = opts.sourceFileId
    ? await prisma.sourceFile.findFirst({
        where: { sourceFileId: opts.sourceFileId },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const modified = opts.sourceModifiedAt ?? new Date();
  let decision = decideDriveFile({
    path: opts.path ?? opts.fileName,
    name: opts.fileName,
    mimeType: opts.mime,
    sizeBytes: opts.buffer.length,
    driveModified: modified,
    existing: existing ? { sourceModifiedAt: existing.sourceModifiedAt } : null,
  });
  if (decision === "skip_unchanged" && (opts.force || !(await hasImportedResults(opts.sourceFileId)))) {
    decision = "process";
  }

  const actions = Array.isArray(run.summaryJson) ? [...(run.summaryJson as FileAction[])] : [];
  let filesImported = run.filesImported;
  let filesSkipped = run.filesSkipped;
  let filesPreview = run.filesPreview;
  let filesFailed = run.filesFailed;
  const filesSeen = run.filesSeen + 1;

  let result: FileAction;
  if (decision !== "process") {
    filesSkipped += 1;
    result = { fileName: opts.fileName, path: opts.path ?? opts.fileName, action: "skipped", reason: decision };
  } else {
    try {
      result = await importDriveBuffer({
        fileName: opts.fileName,
        mime: opts.mime,
        buffer: opts.buffer,
        sourceUrl: opts.sourceUrl,
        sourceFileId: opts.sourceFileId,
        sourceModifiedAt: modified,
        path: opts.path ?? opts.fileName,
      });
      if (result.action === "imported") filesImported += 1;
      else if (result.action === "preview") filesPreview += 1;
      else filesFailed += 1;
    } catch (err) {
      filesFailed += 1;
      result = {
        fileName: opts.fileName,
        path: opts.path ?? opts.fileName,
        action: "failed",
        reason: err instanceof Error ? err.message : "ingest_failed",
      };
    }
  }
  actions.push(result);
  await prisma.driveSyncRun.update({
    where: { id: runId },
    data: {
      filesSeen,
      filesImported,
      filesSkipped,
      filesPreview,
      filesFailed,
      summaryJson: actions as unknown as Prisma.InputJsonValue,
    },
  });
  return { runId, ...result };
}

export async function finishPushIngest(runId: string, config: AppConfig) {
  const run = await prisma.driveSyncRun.findUnique({ where: { id: runId } });
  if (!run) throw Object.assign(new Error("Sync run not found"), { statusCode: 404 });
  const status =
    run.filesFailed > 0 && run.filesImported === 0 && run.filesPreview === 0
      ? "FAILED"
      : run.filesFailed > 0
        ? "PARTIAL"
        : "SUCCESS";
  const updated = await prisma.driveSyncRun.update({
    where: { id: runId },
    data: { status, finishedAt: new Date() },
  });
  await prisma.driveConnection.upsert({
    where: { id: "default" },
    update: { lastSyncAt: new Date(), lastError: null },
    create: { id: "default", folderId: config.GOOGLE_DRIVE_FOLDER_ID, lastSyncAt: new Date() },
  });
  return updated;
}

async function importDriveBuffer(opts: {
  fileName: string;
  mime: string;
  buffer: Buffer;
  sourceUrl?: string;
  sourceFileId?: string;
  sourceModifiedAt?: Date;
  path: string;
}): Promise<FileAction> {
  const userId = await actorUserId();
  if (opts.sourceFileId) {
    await replacePreviousDriveRuns(opts.sourceFileId);
  }
  const job = await createPreview({
    userId,
    fileName: opts.fileName,
    mime: opts.mime,
    buffer: opts.buffer,
    sourceUrl: opts.sourceUrl,
    sourceFileId: opts.sourceFileId,
    sourceModifiedAt: opts.sourceModifiedAt,
  });
  const preview = job.previewJson as {
    counts?: { total?: number };
    parsed?: { defects?: unknown[] };
  };
  const auto = shouldAutoCommit({
    fileName: opts.fileName,
    duplicateCount: job.duplicates.length,
    total: preview.counts?.total ?? 0,
    defectCount: preview.parsed?.defects?.length ?? 0,
  });
  if (auto) {
    const committed = await commitImport(job.id, userId, false);
    return {
      fileName: opts.fileName,
      path: opts.path,
      action: "imported",
      reason: "new_or_updated",
      jobId: job.id,
      runId: committed.runId,
    };
  }
  return {
    fileName: opts.fileName,
    path: opts.path,
    action: "preview",
    reason: job.duplicates.length > 0 ? "duplicates_require_review" : "no_structured_results_or_copy",
    jobId: job.id,
  };
}

async function executeDriveSync(config: AppConfig, runId: string) {
  const actions: FileAction[] = [];
  let filesSeen = 0;
  let filesImported = 0;
  let filesSkipped = 0;
  let filesPreview = 0;
  let filesFailed = 0;

  const finish = async (status: string, errorMessage?: string) => {
    await prisma.driveSyncRun.update({
      where: { id: runId },
      data: {
        status,
        finishedAt: new Date(),
        filesSeen,
        filesImported,
        filesSkipped,
        filesPreview,
        filesFailed,
        summaryJson: actions as unknown as Prisma.InputJsonValue,
        errorMessage: errorMessage?.slice(0, 2000),
      },
    });
    await prisma.driveConnection.upsert({
      where: { id: "default" },
      update: {
        lastSyncAt: new Date(),
        lastError: errorMessage?.slice(0, 2000) ?? null,
      },
      create: {
        id: "default",
        folderId: config.GOOGLE_DRIVE_FOLDER_ID,
        lastSyncAt: new Date(),
        lastError: errorMessage?.slice(0, 2000) ?? null,
      },
    });
  };

  try {
    const { drive, folderId } = await getDrive(config);
    const listed = await listDriveTree(drive, folderId);
    listed.sort((a, b) => b.modifiedTime.getTime() - a.modifiedTime.getTime());
    filesSeen = listed.length;

    let processed = 0;
    for (const file of listed) {
      const existing = await prisma.sourceFile.findFirst({
        where: { sourceFileId: file.id },
        orderBy: { createdAt: "desc" },
      });
      let decision = decideDriveFile({
        path: file.path,
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        driveModified: file.modifiedTime,
        existing: existing ? { sourceModifiedAt: existing.sourceModifiedAt } : null,
      });
      if (decision === "skip_unchanged" && !(await hasImportedResults(file.id))) {
        decision = "process";
      }

      if (decision !== "process") {
        filesSkipped += 1;
        actions.push({
          fileName: file.name,
          path: file.path,
          action: "skipped",
          reason: decision,
        });
        continue;
      }

      if (processed >= config.DRIVE_SYNC_MAX_FILES) {
        filesSkipped += 1;
        actions.push({
          fileName: file.name,
          path: file.path,
          action: "skipped",
          reason: "max_files_this_run",
        });
        continue;
      }

      processed += 1;
      try {
        const downloaded = await downloadDriveFile(drive, file);
        const result = await importDriveBuffer({
          fileName: downloaded.fileName,
          mime: downloaded.mime,
          buffer: downloaded.buffer,
          sourceUrl: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
          sourceFileId: file.id,
          sourceModifiedAt: file.modifiedTime,
          path: file.path,
        });
        if (result.action === "imported") filesImported += 1;
        else filesPreview += 1;
        actions.push(result);
      } catch (err) {
        filesFailed += 1;
        actions.push({
          fileName: file.name,
          path: file.path,
          action: "failed",
          reason: err instanceof Error ? err.message : "download_or_parse_failed",
        });
        logger.warn({ err, file: file.path }, "drive file sync failed");
      }
    }

    const status = filesFailed > 0 && filesImported === 0 && filesPreview === 0 ? "FAILED" : filesFailed > 0 ? "PARTIAL" : "SUCCESS";
    await finish(status);
    logger.info({ runId, filesSeen, filesImported, filesPreview, filesSkipped, filesFailed }, "drive sync finished");
    return runId;
  } catch (err) {
    const message = err instanceof DriveNotConnectedError || err instanceof Error ? err.message : "Drive sync failed";
    await finish(err instanceof DriveNotConnectedError ? "SKIPPED" : "FAILED", message);
    throw err;
  }
}
