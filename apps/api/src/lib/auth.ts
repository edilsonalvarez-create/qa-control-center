import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@prisma/client";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export function authorize(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as { role?: Role } | undefined;
    if (!user?.role || !roles.includes(user.role)) {
      return reply.code(403).send({ error: "Forbidden" });
    }
  };
}

export function sanitizeQuery(value: string, max = 200) {
  return value.replace(/[<>]/g, "").slice(0, max).trim();
}
