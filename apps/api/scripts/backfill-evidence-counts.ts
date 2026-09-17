/**
 * Recount Total and P/F/B/S for existing runs from the Google Sheet already
 * linked as evidence.
 *
 * Dry-run unless --apply. Never lowers a total unless --allow-decrease: a
 * smaller count means the sheet was read partially (wrong tab, or a summary
 * sheet), and the imported value is the better one.
 *
 *   tsx scripts/backfill-evidence-counts.ts [--apply] [--only-manual] [--allow-decrease]
 */
import { prisma } from "../src/lib/prisma.js";
import { parseGoogleSheet } from "../src/services/evidence-parser-service.js";

const apply = process.argv.includes("--apply");
const onlyManual = process.argv.includes("--only-manual");
const allowDecrease = process.argv.includes("--allow-decrease");

const pad = (v: unknown, n: number) => String(v).padEnd(n).slice(0, n);

async function main() {
  const runs = await prisma.testRun.findMany({
    where: onlyManual ? { origin: "MANUAL" } : {},
    include: { module: true, evidence: { select: { fileUrl: true } } },
    orderBy: { executionDate: "desc" },
  });

  const tally = { updated: 0, unchanged: 0, skipped: 0, failed: 0 };

  for (const run of runs) {
    const label = pad(run.module?.name ?? "(sin módulo)", 32);
    const before = `${run.totalTests} ${run.passed}/${run.failed}/${run.blocked}/${run.skipped}`;
    const url = run.evidence.map((e) => e.fileUrl).find((u) => u?.includes("docs.google.com/spreadsheets"));

    if (!url) {
      console.log(`${label} ${pad(before, 14)} -> sin hoja enlazada`);
      tally.skipped++;
      continue;
    }

    try {
      const c = await parseGoogleSheet(url);
      const after = `${c.total} ${c.passed}/${c.failed}/${c.blocked}/${c.skipped}`;

      if (after === before) {
        console.log(`${label} ${pad(before, 14)} -> igual`);
        tally.unchanged++;
        continue;
      }
      if (c.total < run.totalTests && !allowDecrease) {
        console.log(`${label} ${pad(before, 14)} -> ${pad(after, 14)} OMITIDO (bajaría el total)`);
        tally.skipped++;
        continue;
      }

      if (apply) {
        await prisma.testRun.update({
          where: { id: run.id },
          data: {
            evidenceUrl: url,
            totalTests: c.total,
            passed: c.passed,
            failed: c.failed,
            blocked: c.blocked,
            skipped: c.skipped,
          },
        });
      }
      console.log(`${label} ${pad(before, 14)} -> ${pad(after, 14)} ${apply ? "ACTUALIZADO" : "cambiaría"}`);
      tally.updated++;
    } catch (err) {
      console.log(`${label} ${pad(before, 14)} -> ERROR: ${(err as Error).message.slice(0, 60)}`);
      tally.failed++;
    }
  }

  console.log(
    `\n${apply ? "APLICADO" : "SIMULACIÓN (usa --apply para escribir)"} — ` +
      `cambian=${tally.updated} iguales=${tally.unchanged} omitidos=${tally.skipped} errores=${tally.failed}`,
  );
  if (!apply && tally.updated) console.log("Go/No-Go y observaciones no se tocan.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
