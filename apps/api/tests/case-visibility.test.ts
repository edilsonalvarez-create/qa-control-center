import { describe, expect, it } from "vitest";
import { CaseStatus } from "@prisma/client";
import { hasCaseInformation, isListableCase, isPendingStatus, isPlaceholderTitle } from "../src/lib/case-info.js";
import { listableCaseWhere, panelCaseWhere } from "../src/lib/case-visibility.js";

describe("case visibility", () => {
  it("treats placeholder rows without an ID as empty", () => {
    expect(hasCaseInformation({ title: "Requires review" })).toBe(false);
    expect(hasCaseInformation({ title: "Unknown" })).toBe(false);
    expect(hasCaseInformation({ title: "" })).toBe(false);
    expect(isPlaceholderTitle("—")).toBe(true);
  });

  it("keeps rows that have an ID or a real title", () => {
    expect(hasCaseInformation({ title: "Requires review", externalId: "SUMI-MED-001" })).toBe(true);
    expect(hasCaseInformation({ title: "Acceso según rol ( Admin )" })).toBe(true);
  });

  it("lists only executed cases with information", () => {
    expect(isListableCase({ title: "Login", status: CaseStatus.PASS })).toBe(true);
    expect(isListableCase({ title: "Login", status: CaseStatus.UNKNOWN })).toBe(false);
    expect(isListableCase({ title: "Requires review", status: CaseStatus.PASS })).toBe(false);
    expect(isPendingStatus(CaseStatus.UNKNOWN)).toBe(true);
    expect(isPendingStatus(CaseStatus.FAIL)).toBe(false);
  });

  it("panel visibility keeps pending Matriz QA cases while still hiding empty imported rows", () => {
    const panel = panelCaseWhere();
    const listable = listableCaseWhere();
    expect(JSON.stringify(panel)).toContain("MANUAL");
    expect(JSON.stringify(listable)).not.toContain("MANUAL");
  });
});
