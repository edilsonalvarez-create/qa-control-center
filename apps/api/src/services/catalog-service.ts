import { Prisma } from "@prisma/client";
import { CATALOG_CATEGORIES, type CatalogCategory } from "../parsers/catalog.js";
import { parseUpload } from "../parsers/index.js";
import { normalizeProjectName } from "../parsers/normalize.js";
import { prisma } from "../lib/prisma.js";

export function isCatalogCategory(value: string): value is CatalogCategory {
  return (CATALOG_CATEGORIES as readonly string[]).includes(value);
}

export async function listCatalog() {
  return prisma.catalogItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { value: "asc" }],
  });
}

export async function upsertCatalogItems(
  items: Array<{ category: string; value: string; sortOrder: number }>,
) {
  let upserted = 0;
  for (const item of items) {
    if (!isCatalogCategory(item.category) || !item.value.trim()) continue;
    await prisma.catalogItem.upsert({
      where: { category_value: { category: item.category, value: item.value.trim() } },
      update: { sortOrder: item.sortOrder },
      create: { category: item.category, value: item.value.trim(), sortOrder: item.sortOrder },
    });
    if (item.category === "CLIENT") await ensureProjectFromClient(item.value);
    upserted += 1;
  }
  return upserted;
}

async function ensureProjectFromClient(raw: string) {
  const name = normalizeProjectName(raw) || raw.trim();
  if (!name) return;
  const existing = await prisma.project.findUnique({ where: { name } });
  if (existing) return;
  await prisma.project.create({
    data: {
      name,
      client: name,
      product: name === "SANOVA" ? "Unknown" : "HORUS Health",
      status: name === "SANOVA" ? "REQUIRES_REVIEW" : "ACTIVE",
      description: "Created from catalog.",
    },
  });
}

export async function createCatalogItem(category: CatalogCategory, value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw Object.assign(new Error("Value is required"), { statusCode: 400 });
  const max = await prisma.catalogItem.aggregate({
    where: { category },
    _max: { sortOrder: true },
  });
  try {
    const created = await prisma.catalogItem.create({
      data: { category, value: trimmed, sortOrder: (max._max.sortOrder ?? -1) + 1 },
    });
    if (category === "CLIENT") await ensureProjectFromClient(trimmed);
    return created;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw Object.assign(new Error("That value already exists in this list"), { statusCode: 409 });
    }
    throw err;
  }
}

export async function updateCatalogItem(id: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw Object.assign(new Error("Value is required"), { statusCode: 400 });
  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error("Not found"), { statusCode: 404 });
  try {
    const updated = await prisma.catalogItem.update({ where: { id }, data: { value: trimmed } });
    if (existing.category === "CLIENT") await ensureProjectFromClient(trimmed);
    return updated;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw Object.assign(new Error("That value already exists in this list"), { statusCode: 409 });
    }
    throw err;
  }
}

export async function deleteCatalogItem(id: string) {
  const existing = await prisma.catalogItem.findUnique({ where: { id } });
  if (!existing) throw Object.assign(new Error("Not found"), { statusCode: 404 });
  await prisma.catalogItem.delete({ where: { id } });
  return { ok: true, id };
}

export async function importCatalogWorkbook(fileName: string, mime: string, buffer: Buffer) {
  const parsed = await parseUpload(fileName, mime, buffer);
  if (!parsed.catalog?.length) {
    throw Object.assign(new Error("No catalog lists were found in that file"), { statusCode: 400 });
  }
  const upserted = await upsertCatalogItems(parsed.catalog);
  return { upserted, categories: [...new Set(parsed.catalog.map((i) => i.category))], warnings: parsed.warnings };
}
