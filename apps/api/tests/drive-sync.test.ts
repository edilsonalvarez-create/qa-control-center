import { describe, expect, it } from "vitest";
import {
  decideDriveFile,
  exportedFileName,
  isJunkPath,
  isParsableDriveFile,
  nextDriveSyncAt,
  shouldAutoCommit,
  shouldSkipUnchanged,
} from "../src/services/drive-sync-policy.js";

describe("drive file selection", () => {
  it("skips node_modules and lockfiles", () => {
    expect(isJunkPath("Playwright/node_modules/playwright/index.js")).toBe(true);
    expect(isJunkPath("package-lock.json")).toBe(true);
    expect(isJunkPath("SUMIMEDICAL/Matriz_QA_HORUS.xlsx")).toBe(false);
    expect(isJunkPath("actividad de automatización/playwright/results.json")).toBe(true);
    expect(isJunkPath("SUMIMEDICAL/actividad de automatizacion /login.spec.ts")).toBe(true);
  });

  it("accepts QA matrices, reports and Google Docs exports", () => {
    expect(isParsableDriveFile("Matriz_QA.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(true);
    expect(isParsableDriveFile("informe.pdf", "application/pdf")).toBe(true);
    expect(isParsableDriveFile("results.json", "application/json")).toBe(true);
    expect(isParsableDriveFile("Sheet", "application/vnd.google-apps.spreadsheet")).toBe(true);
    expect(isParsableDriveFile("photo.png", "image/png")).toBe(false);
  });

  it("adds an extension when exporting native Google files", () => {
    expect(exportedFileName("Matriz QA", "application/vnd.google-apps.spreadsheet")).toBe("Matriz QA.xlsx");
    expect(exportedFileName("already.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      "already.xlsx",
    );
  });

  it("reprocesses catalog rows without sourceModifiedAt and skips unchanged Drive files", () => {
    const modified = new Date("2026-09-09T11:00:00.000Z");
    expect(shouldSkipUnchanged(null, modified)).toBe(false);
    expect(shouldSkipUnchanged({ sourceModifiedAt: null }, modified)).toBe(false);
    expect(shouldSkipUnchanged({ sourceModifiedAt: modified }, modified)).toBe(true);
    expect(shouldSkipUnchanged({ sourceModifiedAt: new Date("2026-09-08T00:00:00.000Z") }, modified)).toBe(false);
  });

  it("decides process vs skip without inventing results", () => {
    const driveModified = new Date("2026-09-09T11:00:00.000Z");
    expect(
      decideDriveFile({
        path: "SUMIMEDICAL/Matriz_QA.xlsx",
        name: "Matriz_QA.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 12000,
        driveModified,
        existing: null,
      }),
    ).toBe("process");
    expect(
      decideDriveFile({
        path: "suite/node_modules/foo.json",
        name: "foo.json",
        mimeType: "application/json",
        sizeBytes: 10,
        driveModified,
        existing: null,
      }),
    ).toBe("skip_junk");
    expect(
      decideDriveFile({
        path: "actividad de automatización/results.json",
        name: "results.json",
        mimeType: "application/json",
        sizeBytes: 10,
        driveModified,
        existing: null,
      }),
    ).toBe("skip_junk");
    expect(
      decideDriveFile({
        path: "shot.png",
        name: "shot.png",
        mimeType: "image/png",
        sizeBytes: 10,
        driveModified,
        existing: null,
      }),
    ).toBe("skip_unsupported");
  });
});

describe("drive auto-commit policy", () => {
  it("does not auto-commit copies or duplicate fingerprints", () => {
    expect(
      shouldAutoCommit({ fileName: "Copia de Ejecucion_QA.xlsx", duplicateCount: 0, total: 12, defectCount: 0 }),
    ).toBe(false);
    expect(shouldAutoCommit({ fileName: "Ejecucion_QA.xlsx", duplicateCount: 2, total: 12, defectCount: 0 })).toBe(false);
  });

  it("auto-commits only when there are structured results", () => {
    expect(shouldAutoCommit({ fileName: "Ejecucion_QA.xlsx", duplicateCount: 0, total: 12, defectCount: 0 })).toBe(true);
    expect(shouldAutoCommit({ fileName: "bugs.xlsx", duplicateCount: 0, total: 0, defectCount: 3 })).toBe(true);
    expect(shouldAutoCommit({ fileName: "notes.docx", duplicateCount: 0, total: 0, defectCount: 0 })).toBe(false);
  });
});

describe("daily 06:00 America/Bogota", () => {
  it("schedules the next 11:00 UTC slot", () => {
    const before = nextDriveSyncAt(new Date("2026-09-09T10:59:00.000Z"));
    expect(before.toISOString()).toBe("2026-09-09T11:00:00.000Z");
    const after = nextDriveSyncAt(new Date("2026-09-09T11:00:00.000Z"));
    expect(after.toISOString()).toBe("2026-09-10T11:00:00.000Z");
  });
});
