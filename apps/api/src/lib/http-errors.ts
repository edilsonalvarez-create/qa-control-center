import type { FastifyReply } from "fastify";
import { ZodError } from "zod";

/** Shared route error responder: 400 + issue list for Zod errors, otherwise the error's own statusCode (default 500). */
export function fail(reply: FastifyReply, error: unknown) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Datos inválidos", details: error.issues });
  }
  const e = error as Error & { statusCode?: number };
  return reply.code(e.statusCode ?? 500).send({ error: e.message || "Error interno" });
}
