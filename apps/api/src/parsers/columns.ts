import type { ColumnRole, HeaderMapping } from "./types.js";

const SYNONYMS: Record<ColumnRole, string[]> = {
  externalId: ["id", "codigo", "código", "code", "case id", "tc", "caso id", "nro", "no.", "#"],
  title: [
    "titulo",
    "título",
    "title",
    "caso",
    "caso de prueba",
    "escenario",
    "nombre",
    "test case",
    "descripcion del caso",
    "descripción del caso",
  ],
  description: ["descripcion", "descripción", "description", "detalle", "precondicion", "precondición"],
  status: [
    "estado",
    "estado del caso",
    "estado de la prueba",
    "estado de ejecucion",
    "estado del test",
    "estado test",
    "status",
    "pass/fail",
    "pass fail",
    "outcome",
    "resultado",
    "result",
    "ejecucion",
    "ejecución",
  ],
  module: ["modulo", "módulo", "module", "funcionalidad", "componente", "feature"],
  project: ["proyecto", "project", "cliente", "client", "aplicacion", "aplicación"],
  tester: ["qa", "tester", "responsable", "ejecutado por", "analista", "owner"],
  date: ["fecha", "date", "execution date", "fecha ejecucion", "fecha ejecución", "fecha de prueba"],
  severity: ["severidad", "severity", "gravedad"],
  priority: ["prioridad", "priority"],
  type: ["tipo", "type", "tipo de prueba", "test type"],
  environment: ["ambiente", "environment", "env", "entorno"],
  version: ["version", "versión", "build", "release"],
  commit: ["commit", "sha", "revision", "revisión"],
  steps: ["pasos", "steps", "procedimiento"],
  expected: ["esperado", "expected", "resultado esperado"],
  actual: ["obtenido", "actual", "resultado obtenido", "resultado real"],
  ignore: [],
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[_./\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function mapHeader(header: string): { role: ColumnRole; confidence: number } {
  const n = norm(header);
  if (!n) return { role: "ignore", confidence: 0 };
  if (n === "estado" || n.startsWith("estado ")) return { role: "status", confidence: 1 };
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
