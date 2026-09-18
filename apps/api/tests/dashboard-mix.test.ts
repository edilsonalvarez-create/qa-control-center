import { CaseStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { mixFromRunCounters, narrowToResult } from "../src/services/query-service.js";

describe("mixFromRunCounters", () => {
  it("uses the run's own counters instead of its registered cases", () => {
    const m = mixFromRunCounters({ totalTests: 17, passed: 17, failed: 0, blocked: 0, skipped: 0 });
    expect(m.total).toBe(17);
    expect(m.passed).toBe(17);
  });

  it("treats the gap between total and decided cases as pending", () => {
    const m = mixFromRunCounters({ totalTests: 8, passed: 0, failed: 0, blocked: 0, skipped: 0 });
    expect(m.total).toBe(8);
    expect(m.unknown).toBe(8);
  });

  it("counts a mixed run across every bucket", () => {
    const m = mixFromRunCounters({ totalTests: 12, passed: 8, failed: 2, blocked: 1, skipped: 1 });
    expect(m).toMatchObject({ total: 12, passed: 8, failed: 2, blocked: 1, skipped: 1, unknown: 0 });
  });

  it("never reports negative pending when counters exceed the total", () => {
    const m = mixFromRunCounters({ totalTests: 2, passed: 3, failed: 0, blocked: 0, skipped: 0 });
    expect(m.unknown).toBe(0);
  });
});

describe("narrowToResult", () => {
  it("keeps only the filtered result so the KPI matches the Resultado filter", () => {
    const full = mixFromRunCounters({ totalTests: 10, passed: 7, failed: 3, blocked: 0, skipped: 0 });
    const onlyFailed = narrowToResult(full, CaseStatus.FAIL);
    expect(onlyFailed.total).toBe(3);
    expect(onlyFailed.failed).toBe(3);
    expect(onlyFailed.passed).toBe(0);
  });
});
