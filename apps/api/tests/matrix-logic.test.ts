import { describe, expect, it } from "vitest";
import { CaseStatus, RunStatus } from "@prisma/client";
import { deriveRunStatus, manualRunFingerprint, toCaseStatus } from "../src/services/matrix-logic.js";
import { asCase, asEnv, asSev, asTestType } from "../src/parsers/enums.js";

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

describe("manualRunFingerprint", () => {
  it("is stable across casing / spacing and defaults the cycle", () => {
    expect(manualRunFingerprint("p1", "Incapacidades", "1")).toBe("manual|p1|incapacidades|1");
    expect(manualRunFingerprint("p1", " incapacidades ", null)).toBe("manual|p1|incapacidades|1");
    expect(manualRunFingerprint("p1", null, "Ciclo 2")).toBe("manual|p1||ciclo 2");
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
  });
});
