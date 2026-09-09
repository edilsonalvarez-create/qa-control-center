import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import crypto from "node:crypto";
import {
  driveAuthStatus,
  exchangeGoogleCode,
  googleAuthUrl,
  oauthConfigured,
  saveDriveConnection,
} from "../lib/google-drive.js";
import { prisma } from "../lib/prisma.js";
import { enqueueDriveSync, getDriveSyncStatus, beginPushIngest, ingestPushedFile, finishPushIngest } from "../services/drive-sync-service.js";
import { DEFAULT_DRIVE_FOLDER_ID, DRIVE_FOLDER_URL, nextDriveSyncAt } from "../services/drive-sync-policy.js";

export async function driveRoutes(app: FastifyInstance, config: AppConfig) {
  app.get("/api/v1/integrations/google/status", { preHandler: [app.authenticate] }, async () => {
    const auth = await driveAuthStatus(config);
    const sync = await getDriveSyncStatus(config);
    return {
      ...auth,
      folderUrl: `https://drive.google.com/drive/folders/${auth.folderId}`,
      defaultFolderId: DEFAULT_DRIVE_FOLDER_ID,
      defaultFolderUrl: DRIVE_FOLDER_URL,
      nextSyncAt: nextDriveSyncAt(new Date(), config.DRIVE_SYNC_TZ).toISOString(),
      running: sync.running,
      lastRun: sync.last,
      recentRuns: sync.recent,
      schedule: sync.schedule,
      pushIngestEnabled: sync.pushIngestEnabled,
    };
  });

  app.get("/api/v1/integrations/google/start", { preHandler: [app.authenticate, app.requireAdmin] }, async (request, reply) => {
    if (!oauthConfigured(config)) {
      return reply.code(400).send({
        error:
          "OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI on Railway.",
      });
    }
    const user = request.user;
    const state = await reply.jwtSign(
      { sub: user.sub, email: user.email, role: user.role, name: user.name },
      { expiresIn: "15m" },
    );
    return { url: googleAuthUrl(config, state) };
  });

  app.get("/api/v1/integrations/google/callback", async (request, reply) => {
    const q = request.query as { code?: string; state?: string; error?: string };
    const frontend = config.FRONTEND_URL.replace(/\/$/, "");
    if (q.error || !q.code || !q.state) {
      return reply.redirect(`${frontend}/settings?drive=error`);
    }
    try {
      await app.jwt.verify(q.state);
      const tokens = await exchangeGoogleCode(config, q.code);
      if (!tokens.refreshToken) {
        const existing = await prisma.driveConnection.findUnique({ where: { id: "default" } });
        if (!existing?.refreshTokenEnc && !config.GOOGLE_REFRESH_TOKEN) {
          return reply.redirect(`${frontend}/settings?drive=no_refresh_token`);
        }
      }
      await saveDriveConnection({
        config,
        refreshToken: tokens.refreshToken,
        email: tokens.email,
        folderId: config.GOOGLE_DRIVE_FOLDER_ID,
      });
      void enqueueDriveSync(config, "MANUAL");
      return reply.redirect(`${frontend}/settings?drive=connected`);
    } catch {
      return reply.redirect(`${frontend}/settings?drive=error`);
    }
  });

  app.post("/api/v1/integrations/google/sync", { preHandler: [app.authenticate, app.requireManager] }, async () => {
    return enqueueDriveSync(config, "MANUAL");
  });

  app.post("/api/v1/integrations/google/cron", async (request, reply) => {
    if (!cronAuthorized(request, config)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return enqueueDriveSync(config, "HTTP");
  });

  app.post("/api/v1/integrations/google/ingest/begin", async (request, reply) => {
    if (!cronAuthorized(request, config)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return beginPushIngest(config, "APPS_SCRIPT");
  });

  app.post("/api/v1/integrations/google/ingest", async (request, reply) => {
    if (!cronAuthorized(request, config)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    let buffer: Buffer | undefined;
    let fileName = "upload.bin";
    let mime = "application/octet-stream";
    const fields: Record<string, string> = {};
    for await (const part of request.parts()) {
      if (part.type === "file") {
        buffer = await part.toBuffer();
        fileName = part.filename || fileName;
        mime = part.mimetype || mime;
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }
    if (!buffer) return reply.code(400).send({ error: "File required" });
    const modified = fields.sourceModifiedAt ? new Date(fields.sourceModifiedAt) : new Date();
    try {
      return await ingestPushedFile(config, {
        runId: fields.runId || undefined,
        fileName: fields.fileName || fileName,
        mime,
        buffer,
        sourceFileId: fields.sourceFileId || undefined,
        sourceUrl: fields.sourceUrl || undefined,
        sourceModifiedAt: Number.isNaN(modified.getTime()) ? new Date() : modified,
        path: fields.path || fileName,
        force: fields.force === "1" || fields.force === "true",
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });

  app.post("/api/v1/integrations/google/ingest/finish", async (request, reply) => {
    if (!cronAuthorized(request, config)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    const body = (request.body ?? {}) as { runId?: string };
    if (!body.runId) return reply.code(400).send({ error: "runId required" });
    try {
      return await finishPushIngest(body.runId, config);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}

function cronAuthorized(request: { headers: Record<string, unknown> }, config: AppConfig) {
  const header = String(request.headers.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : String(request.headers["x-cron-secret"] ?? "");
  if (!token) return false;
  const expected = config.CRON_SECRET || ingestFallbackSecret(config.JWT_SECRET);
  return token === expected;
}

function ingestFallbackSecret(jwtSecret: string) {
  return crypto.createHmac("sha256", jwtSecret).update("qacc-drive-ingest-v1").digest("hex");
}
