import ExcelJS from "exceljs";
import { isLikelyHeaderRow, mapHeader } from "./columns.js";
import { fingerprint, inferFromFileName, mapStatus, normalizeText } from "./normalize.js";
import type { HeaderMapping, ParsedCase, ParseResult } from "./types.js";

function cellStr(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in (value as object)) {
    return String((value as { text: string }).text ?? "");
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export async function parseExcel(buffer: Buffer, fileName: string): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  // exceljs types accept Buffer via load
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  const inferred = inferFromFileName(fileName);
  const warnings: ParseResult["warnings"] = [];

  if (!sheet) {
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

  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      values[col - 1] = cellStr(cell.value);
    });
    rows.push(values.map((v) => v ?? ""));
  });

  let headerIdx = rows.findIndex((r) => isLikelyHeaderRow(r));
  if (headerIdx < 0) {
    warnings.push({
      code: "HEADERS_UNKNOWN",
      message: "Could not detect a header row with confidence. Rows were not imported as cases.",
    });
    return {
      fileType: "xlsx",
      headers: [],
      cases: [],
      defects: [],
      warnings,
      testType: inferred.testType,
      detectedProject: inferred.project,
      detectedModule: inferred.moduleName,
    };
  }

  const headerCells = rows[headerIdx];
  const headers: HeaderMapping[] = headerCells.map((header, index) => {
    const mapped = mapHeader(header);
    return { index, header, role: mapped.role, confidence: mapped.confidence };
  });

  const titleCol = headers.find((h) => h.role === "title");
  if (!titleCol) {
    warnings.push({
      code: "TITLE_UNKNOWN",
      message: "No title/caso column detected. Cases marked Requires review.",
    });
  }

  const cases: ParsedCase[] = [];
  for (const raw of rows.slice(headerIdx + 1)) {
    if (raw.every((c) => !normalizeText(c))) continue;
    const get = (role: HeaderMapping["role"]) => {
      const h = headers.find((x) => x.role === role);
      return h ? normalizeText(raw[h.index]) : "";
    };
    const title = get("title") || get("externalId") || "Requires review";
    const status = mapStatus(get("status"));
    const project = get("project") || inferred.project;
    const moduleName = get("module") || inferred.moduleName;
    const date = get("date");
    const version = get("version");
    cases.push({
      externalId: get("externalId") || undefined,
      title,
      description: get("description") || get("steps") || undefined,
      status,
      module: moduleName,
      project,
      tester: get("tester") || undefined,
      date: date || undefined,
      severity: get("severity") || undefined,
      priority: get("priority") || undefined,
      type: get("type") || inferred.testType,
      environment: get("environment") || inferred.environment,
      version: version || undefined,
      commit: get("commit") || undefined,
      expected: get("expected") || undefined,
      actual: get("actual") || undefined,
      fingerprint: fingerprint([project, moduleName, title, date, version]),
    });
  }

  const defects = cases
    .filter((c) => c.status === "FAIL")
    .map((c) => ({
      title: c.title,
      description: c.actual || c.description,
      severity: c.severity ? c.severity.toUpperCase() : "UNKNOWN",
      relatedCaseTitle: c.title,
    }));

  return {
    fileType: "xlsx",
    headers,
    cases,
    defects,
    warnings,
    testType: inferred.testType,
    detectedProject: inferred.project,
    detectedModule: inferred.moduleName,
    detectedEnvironment: inferred.environment,
    detectedTester: cases.find((c) => c.tester)?.tester,
    detectedDate: cases.find((c) => c.date)?.date,
  };
}
