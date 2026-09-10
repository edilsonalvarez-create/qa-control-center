import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { importCatalogWorkbook } from "../src/services/catalog-service.js";

const DEFAULT_FILE = path.resolve("C:/Users/edilson.alvarez/Downloads/Catalogo.xlsx");

async function main() {
  const filePath = process.argv[2] || process.env.CATALOG_XLSX || DEFAULT_FILE;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Catalog file not found: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  const result = await importCatalogWorkbook(
    path.basename(filePath),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  );
  const clients = await prisma.catalogItem.findMany({
    where: { category: "CLIENT" },
    select: { value: true },
    orderBy: { value: "asc" },
  });
  console.log(
    JSON.stringify(
      {
        file: path.basename(filePath),
        upserted: result.upserted,
        clients: clients.map((c) => c.value),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
