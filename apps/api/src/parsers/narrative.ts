import { extractNarrativeMetrics, inferFromFileName } from "./normalize.js";
import type { ParseResult } from "./types.js";

export function parsePlainReport(text: string, fileName: string, fileType: string): ParseResult {
  const inferred = inferFromFileName(fileName);
  const { metrics, warnings } = extractNarrativeMetrics(text);
  const dateMatch = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/) ?? text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]20\d{2})\b/);
  const testerMatch = text.match(/Luis Fernando Pacheco/i);

  const defects: ParseResult["defects"] = [];
  const defectLine = /(?:defect|bug|hallazgo|incidencia)[:\s-]+(.{8,120})/gi;
  let m: RegExpExecArray | null;
  while ((m = defectLine.exec(text))) {
    defects.push({
      title: m[1].trim(),
      severity: "UNKNOWN",
    });
  }

  return {
    fileType,
    headers: [],
    cases: [],
    defects,
    metrics,
    warnings,
    observations: text.slice(0, 4000),
    textExcerpt: text.slice(0, 1500),
    testType: inferred.testType === "FUNCTIONAL" ? "UNKNOWN" : inferred.testType,
    detectedProject: inferred.project,
    detectedModule: inferred.moduleName,
    detectedEnvironment: inferred.environment,
    detectedDate: dateMatch?.[1],
    detectedTester: testerMatch ? "Luis Fernando Pacheco" : undefined,
  };
}
