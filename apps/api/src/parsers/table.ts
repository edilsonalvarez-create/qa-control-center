import { isLikelyHeaderRow, mapHeader, mappedCell, pickHeader } from "./columns.js";
import { fingerprint, inferFromFileName, mapStatus, normalizeText } from "./normalize.js";
import type { HeaderMapping, ParsedCase, ParseResult, ParseWarning } from "./types.js";

export function scoreHeaderRow(cells: string[]): number {
  const joined = cells.join(" ").toLowerCase();
  if (/total casos|distribuci[oó]n por|resumen ejecutivo|dashboard de ejecuci/.test(joined)) return -1;
  if (!isLikelyHeaderRow(cells)) return -1;
  const mapped = cells.filter((c) => c && mapHeader(c).confidence >= 0.45).length;
  const hasEstado = cells.some((c) => mapHeader(c).role === "status" && /estado/i.test(c));
  const hasTitle = cells.some((c) => mapHeader(c).role === "title");
  return mapped + (hasEstado ? 25 : 0) + (hasTitle ? 8 : 0);
}

export function scoreSheetName(name: string): number {
  const n = name.toLowerCase();
  if (/dashboard|resumen|m[eé]trica|hallazgo|flujo|cobertura/.test(n)) return -40;
  if (/matriz/.test(n)) return 30;
  return 0;
}

export function parseCaseRows(rows: string[][], fileName: string): {
  headers: HeaderMapping[];
  cases: ParsedCase[];
  warnings: ParseWarning[];
  headerIdx: number;
} {
  const inferred = inferFromFileName(fileName);
  const warnings: ParseWarning[] = [];
  let headerIdx = -1;
  let bestScore = -1;
  rows.forEach((r, i) => {
    const score = scoreHeaderRow(r);
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  });

  if (headerIdx < 0) {
    return {
      headers: [],
      cases: [],
      warnings: [
        {
          code: "HEADERS_UNKNOWN",
          message: "Could not detect a header row with confidence. Rows were not imported as cases.",
        },
      ],
      headerIdx: -1,
    };
  }

  const headers: HeaderMapping[] = rows[headerIdx].map((header, index) => {
    const mapped = mapHeader(header);
    return { index, header, role: mapped.role, confidence: mapped.confidence };
  });

  if (!headers.some((h) => h.role === "title")) {
    warnings.push({
      code: "TITLE_UNKNOWN",
      message: "No title/caso column detected. Cases marked Requires review.",
    });
  }

  const statusHeader = headers.find((h) => h.role === "status");
  if (!statusHeader) {
    warnings.push({
      code: "STATUS_COLUMN_MISSING",
      message: "No Estado column detected. Test status was not inferred; dashboard will not invent PASS/FAIL.",
    });
  } else if (!/estado/i.test(statusHeader.header) && /resultado/i.test(statusHeader.header)) {
    warnings.push({
      code: "STATUS_FROM_RESULTADO",
      message: `Using "${statusHeader.header}" as status because no Estado column was found.`,
    });
  }

  const cases: ParsedCase[] = [];
  for (const raw of rows.slice(headerIdx + 1)) {
    if (raw.every((c) => !normalizeText(c))) continue;
    const get = (role: HeaderMapping["role"]) => mappedCell(headers, raw, role);
    if (pickHeader(headers, "externalId") && !get("externalId")) continue;
    const title = get("title") || get("externalId");
    if (!title) continue;
    const project = get("project") || inferred.project;
    const moduleName = get("module") || inferred.moduleName;
    const date = get("date");
    const version = get("version");
    const status = mapStatus(get("status"));
    cases.push({
      externalId: get("externalId") || undefined,
      title: title || "Requires review",
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

  return { headers, cases, warnings, headerIdx };
}

export function toParseResult(
  fileType: string,
  fileName: string,
  parsed: { headers: HeaderMapping[]; cases: ParsedCase[]; warnings: ParseWarning[] },
): ParseResult {
  const inferred = inferFromFileName(fileName);
  const cases = parsed.cases;
  return {
    fileType,
    headers: parsed.headers,
    cases,
    defects: cases
      .filter((c) => c.status === "FAIL")
      .map((c) => ({
        title: c.title,
        description: c.actual || c.description,
        severity: c.severity ? c.severity.toUpperCase() : "UNKNOWN",
        relatedCaseTitle: c.title,
      })),
    warnings: parsed.warnings,
    testType: inferred.testType,
    detectedProject: inferred.project,
    detectedModule: inferred.moduleName,
    detectedEnvironment: inferred.environment,
    detectedTester: cases.find((c) => c.tester)?.tester,
    detectedDate: cases.find((c) => c.date)?.date,
  };
}
