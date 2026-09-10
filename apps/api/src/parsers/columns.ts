import type { ColumnRole, HeaderMapping } from "./types.js";

const SYNONYMS: Record<ColumnRole, string[]> = {
  externalId: [
    "id",
    "id caso",
    "id cp",
    "id del caso",
    "codigo",
    "código",
    "code",
    "case id",
    "tc",
    "caso id",
    "nro",
    "no.",
    "#",
  ],
  title: [
    "titulo",
    "título",
    "titulo del caso",
    "titulo del caso de prueba",
    "título del caso de prueba",
    "title",
    "caso de prueba",
    "escenario de prueba",
    "escenario",
    "nombre",
    "test case",
    "descripcion del caso",
    "descripción del caso",
  ],
  description: ["descripcion", "descripción", "description", "detalle"],
  status: [
    "estado",
    "estado del caso",
    "estado de la prueba",
    "estado de ejecucion",
    "estado del test",
    "estado test",
    "estado de ejecución",
    "status",
    "pass/fail",
    "pass fail",
    "outcome",
    "resultado",
    "result",
  ],
  module: ["modulo", "módulo", "module", "modulo / componente", "componente", "feature"],
  project: ["proyecto", "project", "cliente", "client", "aplicacion", "aplicación"],
  product: ["proyecto / producto", "producto", "product"],
  tester: ["qa", "tester", "responsable", "ejecutado por", "analista", "owner", "ejecutor"],
  date: ["fecha", "date", "execution date", "fecha ejecucion", "fecha ejecución", "fecha de prueba"],
  severity: ["severidad", "severity", "gravedad", "severidad si falla"],
  priority: ["prioridad", "priority"],
  type: ["tipo", "type", "tipo de prueba", "test type"],
  environment: ["ambiente", "environment", "env", "entorno", "entorno ejecutado"],
  version: ["version", "versión", "build", "release", "release / build"],
  commit: ["commit", "sha", "revision", "revisión"],
  steps: ["pasos", "steps", "procedimiento", "pasos de ejecucion"],
  expected: ["esperado", "expected", "resultado esperado"],
  expectedIntegration: [
    "resultado esperado sistema destino",
    "resultado esperado (sistema destino / integracion)",
    "esperado integracion",
    "expected integration",
  ],
  actual: ["obtenido", "actual", "resultado obtenido", "resultado real"],
  functionality: ["funcionalidad", "functionality"],
  level: ["nivel", "level"],
  automatable: ["automatizable", "automatable"],
  tool: ["herramienta", "tool"],
  preconditions: ["precondicion", "precondición", "precondiciones"],
  testData: ["datos de prueba", "test data", "datos"],
  cycle: ["ciclo", "cycle"],
  reviewedBy: ["revisado por", "revisado por qa lead", "reviewed by"],
  observations: ["observaciones", "observacion", "notes", "notas"],
  evidenceUrl: ["evidencia", "evidencia link", "evidence"],
  requirementRef: ["requisito", "hu", "ticket", "requisito / hu / ticket"],
  sprint: ["sprint", "iteracion", "sprint / iteracion"],
  ignore: [],
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_./\\-]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapHeader(header: string): { role: ColumnRole; confidence: number } {
  const n = norm(header);
  if (!n) return { role: "ignore", confidence: 0 };
  if (n === "estado" || n.startsWith("estado ")) return { role: "status", confidence: 1 };
  if (n === "titulo del caso") return { role: "title", confidence: 1 };
  if (n === "cliente") return { role: "project", confidence: 1 };
  if (n.includes("producto")) return { role: "product", confidence: 1 };
  if (n === "id defecto") return { role: "ignore", confidence: 0 };
  let best: { role: ColumnRole; confidence: number } = { role: "ignore", confidence: 0 };
  for (const [role, list] of Object.entries(SYNONYMS) as [ColumnRole, string[]][]) {
    if (role === "ignore") continue;
    for (const syn of list) {
      const sn = norm(syn);
      if (n === sn) return { role, confidence: 1 };
      if (n.includes(sn) || sn.includes(n)) {
        const conf = Math.min(n.length, sn.length) / Math.max(n.length, sn.length);
        if (conf > best.confidence) best = { role, confidence: conf };
      }
    }
  }
  return best.confidence >= 0.45 ? best : { role: "ignore", confidence: 0 };
}

function statusColumnScore(header: string): number {
  const n = norm(header);
  if (n === "estado" || n.startsWith("estado ")) return 100;
  if (n === "status") return 90;
  if (n.includes("pass") && n.includes("fail")) return 80;
  if (n === "outcome") return 70;
  if (n === "resultado" || n === "result") return 20;
  if (n.includes("ejecucion")) return 15;
  return 50;
}

export function pickHeader(headers: HeaderMapping[], role: ColumnRole): HeaderMapping | undefined {
  const matches = headers.filter((h) => h.role === role);
  if (!matches.length) return undefined;
  if (role !== "status" || matches.length === 1) return matches[0];
  return [...matches].sort((a, b) => statusColumnScore(b.header) - statusColumnScore(a.header) || a.index - b.index)[0];
}

export function mappedCell(headers: HeaderMapping[], row: string[], role: ColumnRole): string {
  const h = pickHeader(headers, role);
  if (!h) return "";
  return (row[h.index] ?? "").replace(/\s+/g, " ").trim();
}

export function isLikelyHeaderRow(cells: string[]): boolean {
  const mapped = cells.filter((c) => c && mapHeader(c).confidence >= 0.45);
  return mapped.length >= 2;
}
