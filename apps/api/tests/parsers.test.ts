import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { mapHeader } from "../src/parsers/columns.js";
import { parseCsv } from "../src/parsers/csv.js";
import { parseExcel } from "../src/parsers/excel.js";
import {
  extractNarrativeMetrics,
  fingerprint,
  inferFromFileName,
  looksLikeCopy,
  mapStatus,
} from "../src/parsers/normalize.js";

describe("header detection", () => {
  it("maps Spanish QA matrix headers", () => {
    expect(mapHeader("ID").role).toBe("externalId");
    expect(mapHeader("Caso de prueba").role).toBe("title");
    expect(mapHeader("Resultado").role).toBe("status");
    expect(mapHeader("Estado").role).toBe("status");
    expect(mapHeader("Estado de Ejecución").role).toBe("status");
    expect(mapHeader("ID Caso").role).toBe("externalId");
    expect(mapHeader("Escenario de Prueba").role).toBe("title");
    expect(mapHeader("//Estado//").role).toBe("status");
    expect(mapHeader("Estado de la prueba").role).toBe("status");
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
    expect(mapStatus("Exitoso")).toBe("PASS");
    expect(mapStatus("Fallido")).toBe("FAIL");
    expect(mapStatus("No cumple")).toBe("FAIL");
    expect(mapStatus("Pendiente")).toBe("UNKNOWN");
    expect(mapStatus("No ejecutado")).toBe("UNKNOWN");
    expect(mapStatus("Pasó")).toBe("PASS");
    expect(mapStatus("Falló")).toBe("FAIL");
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

  it("feeds dashboard status from Estado when Resultado esperado is also present", () => {
    const csv = `ID,Caso de prueba,Resultado esperado,Estado,Módulo
FIX-010,FIXTURE abre orden,Debe mostrar la orden,Exitoso,Ordenes
FIX-011,FIXTURE guarda orden,Debe persistir,Fallido,Ordenes
FIX-012,FIXTURE anula orden,Debe anular,Pendiente,Ordenes`;
    const result = parseCsv(csv, "Matriz_QA_Ordenes_FIXTURE.csv");
    expect(result.cases.map((c) => c.status)).toEqual(["PASS", "FAIL", "UNKNOWN"]);
    expect(result.cases[0].expected).toBe("Debe mostrar la orden");
  });
});

describe("excel parser", () => {
  it("reads Estado from a later sheet when the first sheet is a cover", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Portada").addRow(["Informe QA", "SUMIMEDICAL"]);
    const sheet = wb.addWorksheet("Matriz");
    sheet.addRow(["ID", "Caso de prueba", "Resultado esperado", "Estado"]);
    sheet.addRow(["C-1", "FIXTURE login", "Ingresa al sistema", "Exitoso"]);
    sheet.addRow(["C-2", "FIXTURE logout", "Cierra sesión", "Fallido"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const result = await parseExcel(buffer, "Matriz_QA_Login_FIXTURE.xlsx");
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0].status).toBe("PASS");
    expect(result.cases[1].status).toBe("FAIL");
    expect(result.warnings.some((w) => w.code === "SHEET_SELECTED")).toBe(true);
  });

  it("reads Estado de Ejecución from the matrix sheet, not the dashboard", async () => {
    const wb = new ExcelJS.Workbook();
    const dash = wb.addWorksheet("Dashboard & Métricas");
    dash.addRow(["TOTAL CASOS", "CRÍTICOS", "PRIORIDAD ALTA"]);
    dash.addRow(["9", "1", "6"]);
    const matrix = wb.addWorksheet("Matriz de Pruebas QA");
    matrix.addRow(["ID CP", "Título del Caso de Prueba", "Estado de Ejecución"]);
    matrix.addRow(["TC-001", "FIXTURE particular", "Exitoso"]);
    matrix.addRow(["TC-002", "FIXTURE falla", "Fallido"]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const result = await parseExcel(buffer, "Matriz_QA_Atencion_Particular.xlsx");
    expect(result.cases).toHaveLength(2);
    expect(result.cases[0].status).toBe("PASS");
    expect(result.cases[1].status).toBe("FAIL");
    expect(result.detectedProject).toBe("SUMIMEDICAL");
  });
});

describe("project from Drive folder", () => {
  it("assigns MEDICINA INTEGRAL from the folder path even if the file is named Matriz_QA", () => {
    const fromFolder = inferFromFileName(
      "Matriz_QA_Escalas_Respiratorias.xlsx",
      "MEDICINA INTEGRAL/Matriz_QA_Escalas_Respiratorias.xlsx",
    );
    expect(fromFolder.project).toBe("MEDICINA INTEGRAL");
    expect(inferFromFileName("Matriz_QA_Atencion_Particular.xlsx").project).toBe("SUMIMEDICAL");
    expect(inferFromFileName("Validacion_Modulos_Horus-M.I.xlsx").project).toBe("MEDICINA INTEGRAL");
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
