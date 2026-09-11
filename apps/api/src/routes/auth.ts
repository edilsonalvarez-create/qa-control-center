import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid payload" });
    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    if (!user || !user.active) return reply.code(401).send({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(body.data.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: "Invalid credentials" });
    const token = await reply.jwtSign({
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        allowedModules: user.allowedModules,
      },
    };
  });

  app.get("/api/v1/auth/me", { preHandler: [app.authenticate] }, async (request) => {
    const payload = request.user as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, allowedModules: true },
    });
    return { user };
  });
}
