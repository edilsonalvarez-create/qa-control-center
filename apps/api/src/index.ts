import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { loadConfig } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";
import { authenticate, authorize } from "./lib/auth.js";
import { authRoutes } from "./routes/auth.js";
import { domainRoutes } from "./routes/domain.js";
import { importRoutes } from "./routes/import.js";
import { driveRoutes } from "./routes/drive.js";
import { startDriveSyncScheduler } from "./jobs/drive-cron.js";

async function build() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: config.LOG_LEVEL } });

  const origins = config.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origins.includes("*") || origins.includes(origin)) return cb(null, true);
      if (/^https:\/\/[\w.-]+\.vercel\.app$/.test(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: config.JWT_EXPIRES_IN } });
  await app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  app.decorate("authenticate", authenticate);
  app.decorate("requireQa", authorize("ADMIN", "QA_MANAGER", "QA"));
  app.decorate("requireAdmin", authorize("ADMIN"));
  app.decorate("requireManager", authorize("ADMIN", "QA_MANAGER"));

  app.get("/health", async () => {
    let database = "unknown";
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "up";
    } catch {
      database = "down";
    }
    return { status: database === "up" ? "healthy" : "degraded", version: "1.0.0", database };
  });

  await app.register(authRoutes);
  await app.register(domainRoutes);
  await app.register(importRoutes);
  await driveRoutes(app, config);

  app.setErrorHandler((err, _req, reply) => {
    requestLog(err);
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.code(status).send({ error: status >= 500 ? "Internal error" : (err as Error).message });
  });

  return { app, config };
}

function requestLog(err: unknown) {
  logger.error({ err }, "request error");
}

const { app, config } = await build();
try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  logger.info(`API listening on ${config.PORT}`);
  startDriveSyncScheduler(config);
} catch (err) {
  logger.error({ err }, "failed to listen");
  process.exit(1);
}
