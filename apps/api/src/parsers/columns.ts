import type { ColumnRole } from "./types.js";

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
    "resultado",
    "result",
    "status",
    "pass/fail",
    "pass fail",
    "ejecucion",
    "ejecución",
    "outcome",
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

export function isLikelyHeaderRow(cells: string[]): boolean {
  const mapped = cells.filter((c) => c && mapHeader(c).confidence >= 0.45);
  return mapped.length >= 2;
}
