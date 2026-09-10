import ExcelJS from "exceljs";
import { isCatalogSheetName, looksLikeCatalogHeaderRow, mergeCatalog, parseCatalogRows } from "./catalog.js";
import { inferFromFileName } from "./normalize.js";
import { isSkippedSheetName, parseCaseRows, scoreHeaderRow, scoreSheetName, toParseResult } from "./table.js";
import type { CatalogItemParsed, ParseResult } from "./types.js";

function cellStr(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const o = value as {
      text?: string;
      result?: ExcelJS.CellValue;
      richText?: Array<{ text?: string }>;
      hyperlink?: string;
      formula?: string;
    };
    if (o.hyperlink) return String(o.hyperlink);
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text ?? "").join("");
    if (o.text != null && o.text !== "") return String(o.text);
    if (o.result != null) return cellStr(o.result);
  }
  return "";
}

function sheetRows(sheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellStr(cell.value);
    });
    rows.push(values.map((v) => v ?? ""));
  });
  return rows;
}

export async function parseExcel(buffer: Buffer, fileName: string, sourcePath?: string): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const inferred = inferFromFileName(fileName, sourcePath);

  if (!wb.worksheets.length) {
    return {
      fileType: "xlsx",
      headers: [],
      cases: [],
      defects: [],
      warnings: [{ code: "EMPTY", message: "Workbook has no worksheets" }],
      testType: inferred.testType,
      detectedProject: inferred.project,
      detectedModule: inferred.moduleName,
    };
  }

  let catalog: CatalogItemParsed[] = [];
  let best: { rows: string[][]; score: number; name: string } | undefined;
  for (const sheet of wb.worksheets) {
    const rows = sheetRows(sheet);
    if (isCatalogSheetName(sheet.name) || looksLikeCatalogHeaderRow(rows[0] ?? [])) {
      catalog = mergeCatalog(catalog, parseCatalogRows(rows));
      continue;
    }
    if (isSkippedSheetName(sheet.name)) continue;
    const rowScore = rows.reduce((max, row) => Math.max(max, scoreHeaderRow(row)), -1);
    if (rowScore < 0) continue;
    const score = rowScore + scoreSheetName(sheet.name);
    if (!best || score > best.score) best = { rows, score, name: sheet.name };
  }

  if (!best) {
    return {
      fileType: "xlsx",
      headers: [],
      cases: [],
      catalog: catalog.length ? catalog : undefined,
      defects: [],
      warnings: catalog.length
        ? [
            {
              code: "CATALOG_ONLY",
              message: `Read ${catalog.length} catalog values. No test-case sheet was imported.`,
            },
          ]
        : [
            {
              code: "HEADERS_UNKNOWN",
              message: "Could not detect a header row with confidence. Rows were not imported as cases.",
            },
          ],
      testType: inferred.testType,
      detectedProject: inferred.project,
      detectedModule: inferred.moduleName,
    };
  }

  const parsed = parseCaseRows(best.rows, fileName, sourcePath);
  const result = toParseResult("xlsx", fileName, parsed, sourcePath, catalog);
  if (best.name && wb.worksheets[0]?.name !== best.name) {
    result.warnings.push({
      code: "SHEET_SELECTED",
      message: `Read cases from sheet "${best.name}" because it contained the Estado/matrix headers.`,
    });
  }
  if (catalog.length) {
    result.warnings.push({
      code: "CATALOG_PARSED",
      message: `Read ${catalog.length} catalog values from the Catalogos sheet.`,
    });
  }
  return result;
}
