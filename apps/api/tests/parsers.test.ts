import { describe, expect, it } from "vitest";
import { mapHeader } from "../src/parsers/columns.js";
import { parseCsv } from "../src/parsers/csv.js";
import {
  extractNarrativeMetrics,
  fingerprint,
  looksLikeCopy,
  mapStatus,
} from "../src/parsers/normalize.js";

describe("header detection", () => {
  it("maps Spanish QA matrix headers", () => {
    expect(mapHeader("ID").role).toBe("externalId");
    expect(mapHeader("Caso de prueba").role).toBe("title");
    expect(mapHeader("Resultado").role).toBe("status");
    expect(mapHeader("Módulo").role).toBe("module");
    expect(mapHeader("Fecha ejecución").role).toBe("date");
    expect(mapHeader("Responsable").role).toBe("tester");
  });

  it("does not invent a role for unrelated columns", () => {
    expect(mapHeader("Notas internas XYZ").role).toBe("ignore");
  });
});

describe("status and metrics", () => {
  it("maps pass/fail synonyms without guessing empty as PASS", () => {
    expect(mapStatus("Passed")).toBe("PASS");
    expect(mapStatus("Fallido")).toBe("FAIL");
    expect(mapStatus("")).toBe("UNKNOWN");
    expect(mapStatus("maybe later")).toBe("REQUIRES_REVIEW");
  });

  it("extracts narrative counts from a generic sentence", () => {
    const { metrics, warnings } = extractNarrativeMetrics(
      "FIXTURE: 10 tests ejecutados, 8 passed, 2 failed.",
    );
    expect(metrics?.totalTests).toBe(10);
    expect(metrics?.passed).toBe(8);
    expect(metrics?.failed).toBe(2);
    expect(warnings.some((w) => w.code === "METRIC_MISMATCH")).toBe(false);
  });

  it("flags mismatched narrative totals for review", () => {
    const { warnings } = extractNarrativeMetrics("5 tests ejecutados, 1 passed, 1 failed.");
    expect(warnings.some((w) => w.code === "METRIC_MISMATCH")).toBe(true);
  });
});

describe("csv parser (FIXTURE rows, not HORUS results)", () => {
  it("parses a generic matrix", () => {
    const csv = `ID,Caso de prueba,Módulo,Resultado,Fecha
FIX-001,FIXTURE login válido,Login,PASS,2026-08-01
FIX-002,FIXTURE login inválido,Login,FAIL,2026-08-01`;
    const result = parseCsv(csv, "Matriz_QA_Login_FIXTURE.csv");
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0].status).toBe("PASS");
    expect(result.cases[1].status).toBe("FAIL");
    expect(result.defects).toHaveLength(1);
    expect(result.detectedModule).toBe("Login FIXTURE");
  });
});

describe("duplicates", () => {
  it("detects Copia de filenames", () => {
    expect(looksLikeCopy("Copia de Ejecucion_QA_REGLAS_LINEAS_TELEFONICAS.xlsx")).toBe(true);
    expect(looksLikeCopy("Ejecucion_QA_REGLAS_LINEAS_TELEFONICAS.xlsx")).toBe(false);
  });

  it("builds stable fingerprints", () => {
    const a = fingerprint(["SUMIMEDICAL", "Contrato ventas", "Crear contrato", "2026-09-02", ""]);
    const b = fingerprint(["sumimedical", "Contrato  ventas", "Crear contrato", "2026-09-02", ""]);
    expect(a).toBe(b);
  });
});
