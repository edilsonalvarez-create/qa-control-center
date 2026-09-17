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
    expect(r).toEqual({ total: 8, passed: 3, failed: 2, blocked: 1, skipped: 1, pending: 1 });
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

  it("falls back to a plain Estado column", () => {
    const r = countExecutionStatus(["ID,Estado", "TC-1,Pasó", "TC-2,PASA", "TC-3,FALLÓ"].join("\n"));
    expect(r.total).toBe(3);
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(1);
  });

  it("prefers Estado Ejecución over a generic Estado in the same sheet", () => {
    const r = countExecutionStatus(["ID,Estado,Estado Ejecución", "TC-1,Cerrado,Fallido"].join("\n"));
    expect(r.failed).toBe(1);
  });

  it("ignores rows with an empty status", () => {
    const r = countExecutionStatus(["ID,Estado Ejecución", "TC-1,Exitoso", "TC-2,", "TC-3,   "].join("\n"));
    expect(r.total).toBe(1);
  });

  it("rejects a sheet without any status column", () => {
    expect(() => countExecutionStatus("ID,Componente\nTC-1,Exitoso")).toThrow(/Estado/);
  });

  it("rejects a status column with no filled rows", () => {
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
