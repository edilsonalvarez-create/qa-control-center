import { fingerprint, inferFromFileName, mapStatus } from "./normalize.js";
import type { ParsedCase, ParseResult } from "./types.js";

type PwSpec = {
  title?: string;
  ok?: boolean;
  tests?: Array<{ title?: string; results?: Array<{ status?: string }>; status?: string }>;
};

export function parsePlaywrightJson(text: string, fileName: string): ParseResult {
  const inferred = inferFromFileName(fileName);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      fileType: "json",
      headers: [],
      cases: [],
      defects: [],
      warnings: [{ code: "INVALID_JSON", message: "File is not valid JSON." }],
    };
  }

  const suites = collectSuites(json);
  const cases: ParsedCase[] = [];
  for (const spec of suites) {
    const title = spec.title ?? "Unknown";
    const statusRaw = spec.tests?.[0]?.results?.[0]?.status ?? spec.tests?.[0]?.status ?? (spec.ok === false ? "failed" : spec.ok ? "passed" : "");
    const status = mapStatus(statusRaw);
    cases.push({
      title,
      status,
      project: inferred.project,
      module: inferred.moduleName,
      type: "E2E",
      fingerprint: fingerprint([inferred.project, inferred.moduleName, title, undefined, undefined]),
    });
  }

  if (!cases.length) {
    return {
      fileType: "json",
      headers: [],
      cases: [],
      defects: [],
      warnings: [{ code: "STRUCTURE_UNKNOWN", message: "JSON is not a recognized Playwright report. Marked Requires review." }],
      testType: "E2E",
      detectedProject: inferred.project,
    };
  }

  return {
    fileType: "json",
    headers: [],
    cases,
    defects: cases.filter((c) => c.status === "FAIL").map((c) => ({ title: c.title, severity: "UNKNOWN" })),
    testType: "E2E",
    detectedProject: inferred.project,
    detectedModule: inferred.moduleName,
    warnings: [],
  };
}

function collectSuites(node: unknown, acc: PwSpec[] = []): PwSpec[] {
  if (!node || typeof node !== "object") return acc;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj.specs)) {
    for (const s of obj.specs) acc.push(s as PwSpec);
  }
  if (Array.isArray(obj.suites)) {
    for (const s of obj.suites) collectSuites(s, acc);
  }
  if (obj.stats && Array.isArray(obj.suites) === false && acc.length === 0) {
    // playwright html json sometimes nests under suites only
  }
  return acc;
}
