import { prisma } from "../lib/prisma.js";

/**
 * Single source of truth for "get or create a Project by name" used by the
 * import pipeline, catalog client sync, and the project-attribution repair
 * job. Previously reimplemented three times with subtly different rules
 * (only this version special-cased name === "Unknown"); this is that version.
 */
export async function ensureProject(name: string, product?: string) {
  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing) return existing;
  return prisma.project.create({
    data: {
      name,
      client: name === "Unknown" ? "Unknown" : name,
      product: product || (name === "SANOVA" ? "Unknown" : "HORUS Health"),
      status: name === "Unknown" || name === "SANOVA" ? "REQUIRES_REVIEW" : "ACTIVE",
      description: "Created from import. Requires review if name was inferred.",
    },
  });
}
