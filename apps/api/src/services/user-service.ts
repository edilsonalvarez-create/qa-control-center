import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { isModuleKey } from "../lib/modules.js";

const moduleList = z
  .array(z.string())
  .default([])
  .transform((mods) => mods.filter(isModuleKey));

const createInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(200),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.nativeEnum(Role).default(Role.VIEWER),
  allowedModules: moduleList,
});

const updateInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  role: z.nativeEnum(Role).optional(),
  active: z.boolean().optional(),
  allowedModules: moduleList.optional(),
  password: z.string().min(8, "Mínimo 8 caracteres").optional(),
});

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  allowedModules: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

function err(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export async function listUsers() {
  return prisma.user.findMany({ select: userSelect, orderBy: { createdAt: "asc" } });
}

export async function createUser(raw: unknown) {
  const input = createInput.parse(raw);
  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        allowedModules: input.allowedModules,
        passwordHash,
      },
      select: userSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw err("Ya existe un usuario con ese correo", 409);
    }
    throw error;
  }
}

export async function updateUser(id: string, raw: unknown, actingUserId: string) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw err("Usuario no encontrado", 404);
  const input = updateInput.parse(raw);

  if ((input.role !== undefined || input.active === false) && existing.role === Role.ADMIN) {
    const demotesOrDeactivates = (input.role !== undefined && input.role !== Role.ADMIN) || input.active === false;
    if (demotesOrDeactivates) {
      const otherActiveAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, active: true, id: { not: id } },
      });
      if (otherActiveAdmins === 0) {
        throw err("Debe quedar al menos un administrador activo", 409);
      }
    }
  }
  if (id === actingUserId && (input.active === false || (input.role !== undefined && input.role !== Role.ADMIN))) {
    throw err("No puedes quitarte tu propio acceso de administrador", 400);
  }

  const data: Prisma.UserUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.active !== undefined) data.active = input.active;
  if (input.allowedModules !== undefined) data.allowedModules = input.allowedModules;
  if (input.password) data.passwordHash = await bcrypt.hash(input.password, 12);

  return prisma.user.update({ where: { id }, data, select: userSelect });
}
