import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import {
  driveAuthStatus,
  exchangeGoogleCode,
  googleAuthUrl,
  oauthConfigured,
  saveDriveConnection,
} from "../lib/google-drive.js";
import { prisma } from "../lib/prisma.js";
import { enqueueDriveSync, getDriveSyncStatus } from "../services/drive-sync-service.js";
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
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : String(request.headers["x-cron-secret"] ?? "");
    if (!config.CRON_SECRET || token !== config.CRON_SECRET) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
    return enqueueDriveSync(config, "HTTP");
  });
}
