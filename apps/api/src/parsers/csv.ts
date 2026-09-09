import { isLikelyHeaderRow, mapHeader } from "./columns.js";
import { fingerprint, inferFromFileName, mapStatus, normalizeText } from "./normalize.js";
import type { HeaderMapping, ParsedCase, ParseResult } from "./types.js";

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function parseCsv(text: string, fileName: string): ParseResult {
  const inferred = inferFromFileName(fileName);
  const rows = parseCsvText(text);
  const warnings: ParseResult["warnings"] = [];
  const headerIdx = rows.findIndex((r) => isLikelyHeaderRow(r));
  if (headerIdx < 0) {
    return {
      fileType: "csv",
      headers: [],
      cases: [],
      defects: [],
      warnings: [{ code: "HEADERS_UNKNOWN", message: "CSV headers could not be detected." }],
      testType: inferred.testType,
      detectedProject: inferred.project,
      detectedModule: inferred.moduleName,
    };
  }
  const headers: HeaderMapping[] = rows[headerIdx].map((header, index) => {
    const mapped = mapHeader(header);
    return { index, header, role: mapped.role, confidence: mapped.confidence };
  });
  const cases: ParsedCase[] = [];
  for (const raw of rows.slice(headerIdx + 1)) {
    const get = (role: HeaderMapping["role"]) => {
      const h = headers.find((x) => x.role === role);
      return h ? normalizeText(raw[h.index]) : "";
    };
    const title = get("title") || get("externalId");
    if (!title) continue;
    const project = get("project") || inferred.project;
    const moduleName = get("module") || inferred.moduleName;
    const date = get("date");
    const version = get("version");
    const status = mapStatus(get("status"));
    cases.push({
      externalId: get("externalId") || undefined,
      title,
      description: get("description") || undefined,
      status,
      module: moduleName,
      project,
      tester: get("tester") || undefined,
      date: date || undefined,
      severity: get("severity") || undefined,
      type: get("type") || inferred.testType,
      environment: get("environment") || inferred.environment,
      version: version || undefined,
      fingerprint: fingerprint([project, moduleName, title, date, version]),
    });
  }
  return {
    fileType: "csv",
    headers,
    cases,
    defects: cases
      .filter((c) => c.status === "FAIL")
      .map((c) => ({
        title: c.title,
        description: c.description,
        severity: "UNKNOWN",
        relatedCaseTitle: c.title,
      })),
    warnings,
    testType: inferred.testType,
    detectedProject: inferred.project,
    detectedModule: inferred.moduleName,
  };
}
