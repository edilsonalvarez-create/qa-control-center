import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { commitImport, createPreview } from "../src/services/import-service.js";

const DEFAULT_FILE = path.resolve(
  "C:/Users/edilson.alvarez/Documents/Documentos excel seguro/Matriz_QA_Estandar_Multicliente_v1.xlsx",
);

async function main() {
  const filePath = process.argv[2] || process.env.MATRIX_XLSX || DEFAULT_FILE;
  if (!fs.existsSync(filePath)) {
    throw new Error(`Matrix file not found: ${filePath}`);
  }

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  if (!admin) {
    throw new Error("No active ADMIN user. Run prisma seed first.");
  }

  const buffer = fs.readFileSync(filePath);
  const job = await createPreview({
    userId: admin.id,
    fileName: path.basename(filePath),
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
    sourcePath: filePath,
  });
  const committed = await commitImport(job.id, admin.id, true);
  const catalogCount = await prisma.catalogItem.count();
  const cases = await prisma.testCase.findMany({
    where: { externalId: { in: ["SUMI-MED-001", "SUMI-INC-003"] } },
    select: { externalId: true, status: true, title: true },
  });
  console.log(
    JSON.stringify(
      {
        file: path.basename(filePath),
        jobId: committed.jobId,
        runIds: committed.runIds,
        catalogCount,
        sampleCases: cases,
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
