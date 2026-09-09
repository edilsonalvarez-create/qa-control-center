import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { commitImport, createPreview } from "../services/import-service.js";

export async function importRoutes(app: FastifyInstance) {
  app.post("/api/v1/import/upload", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "File required" });
    const buffer = await file.toBuffer();
    const fields = file.fields as Record<string, { value?: string } | undefined>;
    const sourceUrl = fields?.sourceUrl?.value;
    const sourceFileId = fields?.sourceFileId?.value;
    const user = request.user as { sub: string };
    const job = await createPreview({
      userId: user.sub,
      fileName: file.filename,
      mime: file.mimetype,
      buffer,
      sourceUrl,
      sourceFileId,
    });
    return job;
  });

  app.get("/api/v1/import/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await prisma.importJob.findUnique({
      where: { id },
      include: { sourceFile: true, duplicates: true, conflicts: true },
    });
    if (!job) return reply.code(404).send({ error: "Not found" });
    return job;
  });

  app.get("/api/v1/import", { preHandler: [app.authenticate] }, async () => {
    return prisma.importJob.findMany({
      include: { sourceFile: true, duplicates: true, user: { select: { email: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  });

  app.post("/api/v1/import/:id/commit", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = z.object({ confirmDuplicates: z.boolean().optional() }).safeParse(request.body ?? {});
    const user = request.user as { sub: string };
    try {
      const result = await commitImport(id, user.sub, Boolean(body.success && body.data.confirmDuplicates));
      return result;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 500).send({ error: e.message });
    }
  });
}
