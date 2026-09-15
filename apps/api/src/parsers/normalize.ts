import type { NarrativeMetrics, ParseWarning } from "./types.js";

/**
 * The 5 known client/project names, referenced by all the heuristics below
 * (name hints, drive-path hints, module hints, the final allowlist). Each
 * heuristic still applies its own matching rules tuned to where the hint
 * comes from (raw filename vs. normalized key vs. path segment) — this
 * constant only removes the risk of the *list of names itself* drifting
 * between them.
 */
export const KNOWN_CLIENTS = {
  SUMIMEDICAL: "SUMIMEDICAL",
  MEDICINA_INTEGRAL: "MEDICINA INTEGRAL",
  FERROCARRILES: "FERROCARRILES",
  SANOVA: "SANOVA",
  FOMAG: "FOMAG",
} as const;

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
    /\b(no (cumple|cumplio|ok|pasa|paso|exitoso|exitosa)|fallid[oa]|falla|fallo|failed|fail|error|reprobado|nok|incorrect[oa])\b/.test(
      n,
    )
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

export function normalizeProjectName(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const n = normalizeKey(raw);
  if (/\bsumi\b/.test(n) || n.includes("sumimedical")) return KNOWN_CLIENTS.SUMIMEDICAL;
  if (n.includes("medicina integral") || n.includes("horus m i")) return KNOWN_CLIENTS.MEDICINA_INTEGRAL;
  if (n.includes("ferro")) return KNOWN_CLIENTS.FERROCARRILES;
  if (n.includes("sanova")) return KNOWN_CLIENTS.SANOVA;
  if (n.includes("fomag")) return KNOWN_CLIENTS.FOMAG;
  return raw.replace(/\s+/g, " ").trim();
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

export function mapTestType(raw: string | undefined): string {
  const n = normalizeKey(raw ?? "");
  if (!n) return "UNKNOWN";
  if (/unitari|unit\b/.test(n)) return "UNIT";
  if (/integr/.test(n)) return "INTEGRATION";
  if (/\be2e\b|extremo a extremo|end to end/.test(n)) return "E2E";
  if (/\bapi\b/.test(n)) return "API";
  if (/perform|rendimiento|carga/.test(n)) return "PERFORMANCE";
  if (/segurid|security/.test(n)) return "SECURITY";
  if (/rtm/.test(n)) return "RTM";
  if (/limite|boundary/.test(n)) return "BOUNDARY";
  if (/regres/.test(n)) return "REGRESSION";
  if (/\bsmoke\b|humo/.test(n)) return "SMOKE";
  if (/funcional|functional/.test(n)) return "FUNCTIONAL";
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

function pathHint(value: string): string {
  return value
    .replace(/\\/g, "/")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ ?\/ ?/g, "/")
    .trim();
}

function projectFromNameHints(text: string): string | undefined {
  const n = text.toLowerCase();
  let project: string | undefined;
  if (n.includes("sumimedical") || n.includes("sumi")) project = KNOWN_CLIENTS.SUMIMEDICAL;
  if (n.includes("medicina") || n.includes("m.i") || n.includes("horus-m.i")) project = KNOWN_CLIENTS.MEDICINA_INTEGRAL;
  if (n.includes("ferro")) project = KNOWN_CLIENTS.FERROCARRILES;
  if (n.includes("sanova")) project = KNOWN_CLIENTS.SANOVA;
  if (n.includes("fomag")) project = KNOWN_CLIENTS.FOMAG;
  return project;
}

function projectFromDrivePath(sourcePath?: string): string | undefined {
  if (!sourcePath) return undefined;
  const key = pathHint(sourcePath);
  const folders = key.split("/").filter(Boolean).slice(0, -1);
  const hay = folders.join("/");
  if (!hay) return undefined;
  if (/(^|\/)medicina integral(\/|$)/.test(hay) || /(^|\/)test-medicina/.test(hay)) return KNOWN_CLIENTS.MEDICINA_INTEGRAL;
  if (/(^|\/)sumimedical(\/|$)/.test(hay) || /(^|\/)test-sumi/.test(hay)) return KNOWN_CLIENTS.SUMIMEDICAL;
  if (/(^|\/)ferro/.test(hay) || /(^|\/)test-ferro/.test(hay)) return KNOWN_CLIENTS.FERROCARRILES;
  if (/(^|\/)sanova(\/|$)/.test(hay) || /(^|\/)test-sanova/.test(hay)) return KNOWN_CLIENTS.SANOVA;
  return undefined;
}

function projectFromModuleHints(text: string): string | undefined {
  const n = normalizeKey(text);
  if (!n) return undefined;
  if (/\bphq\b/.test(n) || /stop bang/.test(n) || /\bgerdq\b/.test(n) || /escalas clinicas/.test(n)) {
    return KNOWN_CLIENTS.MEDICINA_INTEGRAL;
  }
  if (/escalas respiratorias/.test(n)) return KNOWN_CLIENTS.MEDICINA_INTEGRAL;
  return undefined;
}

export function resolveProjectName(opts: {
  fileName?: string;
  sourcePath?: string;
  client?: string;
  moduleName?: string;
}): string | undefined {
  const hinted = projectFromModuleHints(
    [opts.fileName, opts.sourcePath, opts.moduleName, opts.client].filter(Boolean).join(" "),
  );
  if (hinted) return hinted;
  const fromPath = projectFromDrivePath(opts.sourcePath);
  if (fromPath) return fromPath;
  const fromClient = normalizeProjectName(opts.client);
  const knownClientNames = new Set<string>(Object.values(KNOWN_CLIENTS));
  if (fromClient && knownClientNames.has(fromClient)) {
    return fromClient;
  }
  const fromName = projectFromNameHints(opts.fileName ?? "");
  if (fromName) return fromName;
  if (opts.fileName && /(matriz_qa|ejecucion_qa|horus)/i.test(opts.fileName) && !/horus-m\.i/i.test(opts.fileName)) {
    return KNOWN_CLIENTS.SUMIMEDICAL;
  }
  return fromClient;
}

export function inferFromFileName(fileName: string, sourcePath?: string) {
  const n = fileName.toLowerCase();
  let moduleName: string | undefined;
  let testType = "FUNCTIONAL";
  let environment: string | undefined;
  let project = resolveProjectName({ fileName, sourcePath });

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

  // Clinical-scale spec matrices (PHQ-4, GerdQ, STOP-Bang, ...) never carry a
  // Módulo/Componente column — they all live under Historia Clínica for
  // MEDICINA INTEGRAL, same as the manual entries already registered there.
  // Normalize first: real filenames use underscores as separators
  // ("Ecala_Gerdq.xlsx", "Ecala_Phq-4.xlsx"), and \b doesn't break on "_"
  // since it's a word character — matching raw against fileName missed them.
  const clinicalScaleKey = normalizeKey(fileName);
  if (/\bphq\b|stop bang|\bgerdq\b|escalas? clinicas?/.test(clinicalScaleKey)) {
    moduleName = moduleName ?? "Historia Clínica";
  }

  return { project, moduleName, testType, environment };
}
