import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import { DEFAULT_ALLOWED, isPermissionKey, PERMISSION_KEYS } from "../src/lib/permissions.js";

describe("permission defaults", () => {
  it("matches today's requireQa behavior for delete (ADMIN/QA_MANAGER/QA, not VIEWER)", () => {
    expect(DEFAULT_ALLOWED.delete).toEqual(
      expect.arrayContaining([Role.ADMIN, Role.QA_MANAGER, Role.QA]),
    );
    expect(DEFAULT_ALLOWED.delete).not.toContain(Role.VIEWER);
  });
});

describe("isPermissionKey", () => {
  it("only accepts the canonical permission keys", () => {
    for (const key of PERMISSION_KEYS) expect(isPermissionKey(key)).toBe(true);
    expect(isPermissionKey("not-a-permission")).toBe(false);
  });
});
