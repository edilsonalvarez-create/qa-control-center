import { describe, expect, it } from "vitest";
import { hasModuleAccess, isModuleKey, MODULE_KEYS } from "../src/lib/modules.js";

describe("hasModuleAccess", () => {
  it("gives ADMIN full access regardless of allowedModules", () => {
    expect(hasModuleAccess("ADMIN", [], "matrix")).toBe(true);
    expect(hasModuleAccess("ADMIN", ["dashboard"], "matrix")).toBe(true);
  });

  it("treats an empty allowedModules list as unrestricted", () => {
    expect(hasModuleAccess("QA", [], "matrix")).toBe(true);
    expect(hasModuleAccess("VIEWER", [], "settings")).toBe(true);
  });

  it("restricts a non-admin to their explicit module list", () => {
    expect(hasModuleAccess("QA", ["matrix", "dashboard"], "matrix")).toBe(true);
    expect(hasModuleAccess("QA", ["matrix", "dashboard"], "catalog")).toBe(false);
  });
});

describe("isModuleKey", () => {
  it("only accepts the canonical module keys", () => {
    for (const key of MODULE_KEYS) expect(isModuleKey(key)).toBe(true);
    expect(isModuleKey("not-a-module")).toBe(false);
    expect(isModuleKey("users")).toBe(false);
  });
});
