import { describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import { normalizeFilterQuery } from "../src/lib/filters.js";

describe("normalizeFilterQuery", () => {
  it("maps catalog Spanish labels to Prisma enums so FilterBar catalog values actually match stored rows", () => {
    expect(
      normalizeFilterQuery({
        testType: "Funcional",
        environment: "Producción",
        result: "Falla",
        severity: "Alta",
      }),
    ).toEqual({
      testType: "FUNCTIONAL",
      environment: "PROD",
      result: CaseStatus.FAIL,
      severity: "HIGH",
    });
  });

  it("passes through already-normalized enum codes", () => {
    expect(
      normalizeFilterQuery({
        testType: "E2E",
        environment: "QA",
        result: "PASS",
        severity: "CRITICAL",
      }),
    ).toEqual({
      testType: "E2E",
      environment: "QA",
      result: CaseStatus.PASS,
      severity: "CRITICAL",
    });
  });

  it("leaves empty filters undefined", () => {
    expect(normalizeFilterQuery({})).toEqual({
      testType: undefined,
      environment: undefined,
      result: undefined,
      severity: undefined,
    });
  });
});
