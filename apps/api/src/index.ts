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

async function build() {
  const config = loadConfig();
  const app = Fastify({ logger });

  const origins = config.CORS_ORIGINS.split(",").map((s) => s.trim());
  await app.register(cors, { origin: origins, credentials: true });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(jwt, { secret: config.JWT_SECRET, sign: { expiresIn: config.JWT_EXPIRES_IN } });
  await app.register(rateLimit, { max: config.RATE_LIMIT_MAX, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  app.decorate("authenticate", authenticate);
  app.decorate("requireQa", authorize("ADMIN", "QA_MANAGER", "QA"));
  app.decorate("requireAdmin", authorize("ADMIN"));

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
  } catch (err) {
  logger.error({ err }, "failed to listen");
  process.exit(1);
}
