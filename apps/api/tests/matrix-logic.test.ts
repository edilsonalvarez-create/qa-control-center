import { describe, expect, it } from "vitest";
import { CaseStatus, RunStatus } from "@prisma/client";
import { deriveRunStatus, manualRunFingerprint, toCaseStatus, usesManualRunContainer } from "../src/services/matrix-logic.js";
import { asCase, asEnv, asSev, asTestType } from "../src/parsers/enums.js";
import { mapSeverity } from "../src/parsers/normalize.js";

describe("toCaseStatus (Matriz QA manual entry)", () => {
  it("maps Spanish matrix labels", () => {
    expect(toCaseStatus("Pasa")).toBe(CaseStatus.PASS);
    expect(toCaseStatus("Falla")).toBe(CaseStatus.FAIL);
    expect(toCaseStatus("Bloqueado")).toBe(CaseStatus.BLOCKED);
    expect(toCaseStatus("No ejecutado")).toBe(CaseStatus.UNKNOWN);
    expect(toCaseStatus("En progreso")).toBe(CaseStatus.UNKNOWN);
    expect(toCaseStatus("")).toBe(CaseStatus.UNKNOWN);
    expect(toCaseStatus(undefined)).toBe(CaseStatus.UNKNOWN);
  });

  it("accepts the normalized codes too", () => {
    expect(toCaseStatus("PASS")).toBe(CaseStatus.PASS);
    expect(toCaseStatus("FAIL")).toBe(CaseStatus.FAIL);
  });
});

describe("deriveRunStatus", () => {
  it("prefers FAILED, then BLOCKED, then PASSED", () => {
    expect(deriveRunStatus({ passed: 3, failed: 1, blocked: 0 })).toBe(RunStatus.FAILED);
    expect(deriveRunStatus({ passed: 3, failed: 0, blocked: 2 })).toBe(RunStatus.BLOCKED);
    expect(deriveRunStatus({ passed: 3, failed: 0, blocked: 0 })).toBe(RunStatus.PASSED);
    expect(deriveRunStatus({ passed: 0, failed: 0, blocked: 0 })).toBe(RunStatus.UNKNOWN);
  });
});

describe("usesManualRunContainer", () => {
  it("keeps imported cases on their original run", () => {
    expect(usesManualRunContainer("MANUAL")).toBe(true);
    expect(usesManualRunContainer("IMPORT")).toBe(false);
  });
});

describe("manualRunFingerprint", () => {
  it("groups by cycle when the QA sets one explicitly, stable across casing/spacing", () => {
    expect(manualRunFingerprint("p1", "Incapacidades", "1")).toBe("manual|p1|incapacidades|cycle:1");
    expect(manualRunFingerprint("p1", " incapacidades ", "1")).toBe("manual|p1|incapacidades|cycle:1");
    expect(manualRunFingerprint("p1", null, "Ciclo 2")).toBe("manual|p1||cycle:ciclo 2");
  });

  it("without a cycle, keys by the case's own identity so different cases never merge", () => {
    expect(manualRunFingerprint("p1", "Historia Clinica", null, "RESUMEN-GERDQ-001")).toBe(
      "manual|p1|historia clinica|case:resumen-gerdq-001",
    );
    expect(manualRunFingerprint("p1", "Historia Clinica", null, "RESU-PHQ4-001")).not.toBe(
      manualRunFingerprint("p1", "Historia Clinica", null, "RESUMEN-GERDQ-001"),
    );
    // re-editing the same case (same identity) resolves back to the same run
    expect(manualRunFingerprint("p1", "Historia Clinica", undefined, "RESUMEN-GERDQ-001")).toBe(
      manualRunFingerprint("p1", "Historia Clinica", null, "RESUMEN-GERDQ-001"),
    );
  });
});

describe("enum coercion helpers", () => {
  it("coerces free text to Prisma enums", () => {
    expect(asTestType("Integración")).toBe("INTEGRATION");
    expect(asEnv("Producción")).toBe("PROD");
    expect(asCase("PASS")).toBe(CaseStatus.PASS);
    expect(asCase("no-such-thing")).toBe(CaseStatus.REQUIRES_REVIEW);
    expect(asSev("HIGH")).toBe("HIGH");
    expect(asSev(undefined)).toBe("UNKNOWN");
    // BUG-001: Spanish labels collapse to UNKNOWN unless mapSeverity runs first.
    expect(asSev("Alta")).toBe("UNKNOWN");
    expect(asSev(mapSeverity("Alta"))).toBe("HIGH");
    expect(asSev(mapSeverity("Crítica"))).toBe("CRITICAL");
    expect(asSev(mapSeverity("Baja"))).toBe("LOW");
  });
});
