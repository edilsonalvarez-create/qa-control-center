import { describe, expect, it } from "vitest";
import { countExecutionStatus, extractSheetId } from "../src/services/evidence-parser-service.js";

/** Mirrors a real Matriz QA export: title banner, accents, quoted multi-line cells. */
const SHEET = [
  "Matriz QA - Historia Clínica,,",
  "Cliente,SUMIMEDICAL,",
  "ID,Descripción,Estado Ejecución",
  'TC-001,"Paso 1: abrir\nPaso 2: validar, guardar",Exitoso',
  "TC-002,Campo condicional,Pasó",
  "TC-003,Consentimiento,OK",
  "TC-004,Aval quirúrgico,Fallido",
  "TC-005,Reserva de cama,Falló",
  "TC-006,Marcapasos,Bloqueado",
  "TC-007,Insumos,No aplica",
  "TC-008,Hemocomponentes,Pendiente",
].join("\n");

describe("countExecutionStatus", () => {
  it("counts one row per case from the Estado Ejecución column", () => {
    const r = countExecutionStatus(SHEET);
    expect(r.total).toBe(8);
    expect(r.passed).toBe(3);
    expect(r.failed).toBe(2);
    expect(r.blocked).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.pending).toBe(1);
  });

  it("does not split rows on newlines inside quoted cells", () => {
    expect(countExecutionStatus(SHEET).total).toBe(8);
  });

  it("counts an 18-case matrix as 18, not 1", () => {
    const rows = ["ID,Estado Ejecución", ...Array.from({ length: 18 }, (_, i) => `TC-${i},Exitoso`)];
    const r = countExecutionStatus(rows.join("\n"));
    expect(r.total).toBe(18);
    expect(r.passed).toBe(18);
  });

  it("ignores rows with an empty status", () => {
    const r = countExecutionStatus("ID,Estado Ejecución\nTC-1,Exitoso\nTC-2,\nTC-3,   ");
    expect(r.total).toBe(1);
  });

  it("rejects a sheet without the column", () => {
    expect(() => countExecutionStatus("ID,Resultado\nTC-1,Exitoso")).toThrow(/Estado Ejecución/);
  });

  it("rejects a column with no filled rows", () => {
    expect(() => countExecutionStatus("ID,Estado Ejecución\nTC-1,")).toThrow(/ninguna fila/);
  });
});

describe("extractSheetId", () => {
  it("pulls the id out of an edit url", () => {
    expect(extractSheetId("https://docs.google.com/spreadsheets/d/1AbC-dEf_9/edit#gid=42")).toBe("1AbC-dEf_9");
  });

  it("returns null for a non-sheet url", () => {
    expect(extractSheetId("https://drive.google.com/file/d/123/view")).toBeNull();
  });
});
