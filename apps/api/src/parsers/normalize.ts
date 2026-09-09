import type { NarrativeMetrics, ParseWarning } from "./types.js";

export function normalizeText(value: string | undefined | null): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fingerprint(parts: Array<string | undefined>): string {
  return parts.map((p) => normalizeKey(p ?? "")).filter(Boolean).join("|");
}

export function mapStatus(raw: string | undefined): string {
  const n = normalizeKey(raw ?? "");
  if (!n) return "UNKNOWN";
  if (
    /\b(no (cumple|cumplio|ok|pasa|paso|exitoso|exitosa)|fallid[oa]|fallo|failed|fail|error|reprobado|nok)\b/.test(n)
  ) {
    return "FAIL";
  }
  if (
    /\b(pass|passed|ok|exitoso|exitosa|aprobad[oa]|satisfactori[oa]|cumple|cumplio|pasa|paso)\b/.test(n) ||
    n === "pass" ||
    n === "p"
  ) {
    return "PASS";
  }
  if (/\b(block|blocked|bloquead[oa])\b/.test(n)) return "BLOCKED";
  if (/\b(skip|skipped|omitid[oa]|n a|na|no aplica)\b/.test(n)) return "SKIPPED";
  if (/\b(pendiente|no ejecutad[oa]|por ejecutar|sin ejecutar|en progreso|en ejecucion)\b/.test(n)) return "UNKNOWN";
  return "REQUIRES_REVIEW";
}

export function mapSeverity(raw: string | undefined): string {
  const n = normalizeKey(raw ?? "");
  if (!n) return "UNKNOWN";
  if (/critic/.test(n) || n === "p1") return "CRITICAL";
  if (/high|alta|p2/.test(n)) return "HIGH";
  if (/med|media|p3/.test(n)) return "MEDIUM";
  if (/low|baja|p4/.test(n)) return "LOW";
  return "UNKNOWN";
}

export function mapEnvironment(raw: string | undefined): string {
  const n = normalizeKey(raw ?? "");
  if (!n) return "UNKNOWN";
  if (/\bdev\b|desarrollo/.test(n)) return "DEV";
  if (/\bqa\b/.test(n)) return "QA";
  if (/\btest\b/.test(n)) return "TEST";
  if (/stag/.test(n)) return "STAGING";
  if (/prod|produccion/.test(n)) return "PROD";
  return "UNKNOWN";
}

export function extractNarrativeMetrics(text: string): { metrics?: NarrativeMetrics; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = [];
  const src = text.replace(/\s+/g, " ");
  const total =
    src.match(/(\d+)\s*(?:tests?|casos?|pruebas?)\s*(?:ejecutados?|executed)?/i) ??
    src.match(/total(?:\s*(?:de)?\s*(?:tests?|casos?))?[:\s]+(\d+)/i);
  const passed = src.match(/(\d+)\s*(?:passed|exitosos?|aprobados?)/i);
  const failed = src.match(/(\d+)\s*(?:failed|fallidos?|fallaron)/i);
  const blocked = src.match(/(\d+)\s*(?:blocked|bloqueados?)/i);
  const skipped = src.match(/(\d+)\s*(?:skipped|omitidos?)/i);

  if (!total && !passed && !failed) return { warnings };

  const metrics: NarrativeMetrics = {
    totalTests: total ? Number(total[1]) : undefined,
    passed: passed ? Number(passed[1]) : undefined,
    failed: failed ? Number(failed[1]) : undefined,
    blocked: blocked ? Number(blocked[1]) : undefined,
    skipped: skipped ? Number(skipped[1]) : undefined,
    source: "narrative",
  };

  const sum =
    (metrics.passed ?? 0) + (metrics.failed ?? 0) + (metrics.blocked ?? 0) + (metrics.skipped ?? 0);
  if (metrics.totalTests != null && sum > 0 && metrics.totalTests !== sum) {
    warnings.push({
      code: "METRIC_MISMATCH",
      message: `Narrative total ${metrics.totalTests} does not equal pass+fail+blocked+skipped (${sum}). Marked for review.`,
    });
  }
  return { metrics, warnings };
}

export function looksLikeCopy(fileName: string): boolean {
  return /^copia de\s+/i.test(fileName) || /\bcopy of\b/i.test(fileName);
}

export function inferFromFileName(fileName: string) {
  const n = fileName.toLowerCase();
  let project: string | undefined;
  let moduleName: string | undefined;
  let testType = "FUNCTIONAL";
  let environment: string | undefined;

  if (n.includes("sumimedical") || n.includes("sumi")) project = "SUMIMEDICAL";
  if (n.includes("medicina") || n.includes("m.i") || n.includes("horus-m.i")) project = "MEDICINA INTEGRAL";
  if (n.includes("ferro")) project = "FERROCARRILES";
  if (n.includes("sanova")) project = "SANOVA";
  if (!project && /(matriz_qa|ejecucion_qa|horus)/i.test(n)) project = "SUMIMEDICAL";

  if (n.includes("playwright") || n.includes(".spec.")) testType = "E2E";
  if (n.includes("rtm")) testType = "RTM";
  if (n.includes("limite") || n.includes("límite") || n.includes("boundary")) testType = "BOUNDARY";
  if (n.includes("dev")) environment = "DEV";
  if (n.includes("produccion") || n.includes("producción") || n.includes("prod")) environment = "PROD";

  const matriz = fileName.match(/Matriz_QA[_ ](.+?)\.(xlsx|xls|csv)/i);
  if (matriz) moduleName = matriz[1].replace(/[_]+/g, " ").trim();
  const ejec = fileName.match(/Ejecucion_QA[_ ](.+?)\.(xlsx|xls|csv)/i);
  if (ejec) moduleName = ejec[1].replace(/[_]+/g, " ").trim();

  if (/impresion|impresión|lineas telefonicas|líneas telefónicas/i.test(fileName)) {
    moduleName = moduleName ?? "Impresión de órdenes / reglas de líneas telefónicas";
  }

  return { project, moduleName, testType, environment };
}
