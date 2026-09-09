import { parseCsv } from "./csv.js";
import { parseDocx } from "./docx.js";
import { parseExcel } from "./excel.js";
import { parsePdf } from "./pdf.js";
import { parsePlaywrightJson } from "./playwright-json.js";
import { inferFromFileName, looksLikeCopy } from "./normalize.js";
import type { ParseResult } from "./types.js";

export async function parseUpload(fileName: string, mime: string, buffer: Buffer): Promise<ParseResult> {
  const lower = fileName.toLowerCase();
  const inferred = inferFromFileName(fileName);
  let result: ParseResult;

  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || mime.includes("spreadsheet")) {
    result = await parseExcel(buffer, fileName);
  } else if (lower.endsWith(".csv") || mime.includes("csv")) {
    result = parseCsv(buffer.toString("utf8"), fileName);
  } else if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) {
    result = await parseDocx(buffer, fileName);
  } else if (lower.endsWith(".pdf") || mime.includes("pdf")) {
    result = await parsePdf(buffer, fileName);
  } else if (lower.endsWith(".json") || mime.includes("json")) {
    result = parsePlaywrightJson(buffer.toString("utf8"), fileName);
  } else {
    result = {
      fileType: "unknown",
      headers: [],
      cases: [],
      defects: [],
      warnings: [{ code: "UNSUPPORTED", message: `Format not parsed automatically (${fileName}). Requires review.` }],
    };
  }

  if (looksLikeCopy(fileName)) {
    result.warnings.push({
      code: "COPY_FILENAME",
      message: "Filename looks like a copy (Copia de / Copy of). Duplicate detection is required before commit.",
    });
  }

  result.detectedProject = result.detectedProject ?? inferred.project;
  result.detectedModule = result.detectedModule ?? inferred.moduleName;
  result.detectedEnvironment = result.detectedEnvironment ?? inferred.environment;
  result.testType = result.testType ?? inferred.testType;
  return result;
}

export { extractNarrativeMetrics } from "./normalize.js";
export { fingerprint, mapStatus, looksLikeCopy } from "./normalize.js";
export { mapHeader } from "./columns.js";
export { parseCsv } from "./csv.js";
export type { ParseResult } from "./types.js";
