import type { FastifyInstance, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { parseFilters } from "../lib/filters.js";
import {
  createManualCase,
  deleteManualCase,
  importMatrixWorkbook,
  listAllProjects,
  listMatrixCases,
  updateManualCase,
} from "../services/matrix-service.js";

function fail(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Datos inválidos", details: error.issues });
  }
  const e = error as Error & { statusCode?: number };
  return reply.code(e.statusCode ?? 500).send({ error: e.message || "Error interno" });
}

export async function matrixRoutes(app: FastifyInstance) {
  app.get("/api/v1/matrix/cases", { preHandler: [app.authenticate] }, async (request) => {
    const filters = parseFilters(request);
    const origin = (request.query as { origin?: string }).origin;
    return listMatrixCases({ ...filters, origin });
  });

  app.get("/api/v1/matrix/projects", { preHandler: [app.authenticate] }, async () => {
    return listAllProjects();
  });

  app.post("/api/v1/matrix/cases", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const user = request.user as { sub: string };
    try {
      return await createManualCase(request.body, user.sub);
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.patch("/api/v1/matrix/cases/:id", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    try {
      return await updateManualCase(id, request.body, user.sub);
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.delete("/api/v1/matrix/cases/:id", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = request.user as { sub: string };
    try {
      return await deleteManualCase(id, user.sub);
    } catch (error) {
      return fail(reply, error);
    }
  });

  app.post("/api/v1/matrix/import", { preHandler: [app.authenticate, app.requireQa] }, async (request, reply) => {
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "Archivo requerido" });
    const buffer = await file.toBuffer();
    const user = request.user as { sub: string };
    try {
      return await importMatrixWorkbook({
        userId: user.sub,
        fileName: file.filename,
        mime: file.mimetype,
        buffer,
      });
    } catch (error) {
      return fail(reply, error);
    }
  });
}
