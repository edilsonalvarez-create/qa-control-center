import { looksLikeCopy } from "../parsers/normalize.js";

export const DEFAULT_DRIVE_FOLDER_ID = "1hCe3QBPraJEvt6H60KcCOiNIFzG6zdL-";
export const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;
export const MAX_DRIVE_FILE_BYTES = 25 * 1024 * 1024;

const JUNK_DIR =
  /(^|\/)(node_modules|\.git|\.svn|\.venv|dist|build|coverage|\.next|__pycache__|\.turbo)(\/|$)/i;
const JUNK_NAME = /^(\.ds_store|thumbs\.db|desktop\.ini|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/i;
const EXCLUDED_DIR = /(^|\/)actividad de automatizacion(\/|$)/;
const PARSEABLE_EXT = /\.(xlsx|xls|csv|pdf|docx|json)$/i;

const GOOGLE_EXPORT: Record<string, { mime: string; ext: string }> = {
  "application/vnd.google-apps.spreadsheet": {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: ".xlsx",
  },
  "application/vnd.google-apps.document": {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ext: ".docx",
  },
};

export type DriveFileDecision =
  | "process"
  | "skip_junk"
  | "skip_unsupported"
  | "skip_unchanged"
  | "skip_too_large";

export function normalizeDrivePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ ?\/ ?/g, "/")
    .trim();
}

export function isJunkPath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const name = normalized.split("/").pop() ?? normalized;
  const key = normalizeDrivePath(path);
  return JUNK_DIR.test(normalized) || EXCLUDED_DIR.test(key) || JUNK_NAME.test(name);
}

export function googleExportSpec(mimeType: string) {
  return GOOGLE_EXPORT[mimeType];
}

export function isParsableDriveFile(name: string, mimeType: string): boolean {
  if (GOOGLE_EXPORT[mimeType]) return true;
  if (PARSEABLE_EXT.test(name)) return true;
  return (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("csv") ||
    mimeType.includes("pdf") ||
    mimeType.includes("wordprocessingml") ||
    mimeType === "application/json"
  );
}

export function exportedFileName(name: string, mimeType: string): string {
  const spec = GOOGLE_EXPORT[mimeType];
  if (!spec) return name;
  if (PARSEABLE_EXT.test(name)) return name;
  return `${name}${spec.ext}`;
}

export function shouldSkipUnchanged(
  existing: { sourceModifiedAt: Date | null } | null,
  driveModified: Date,
): boolean {
  if (!existing?.sourceModifiedAt) return false;
  return existing.sourceModifiedAt.getTime() >= driveModified.getTime();
}

export function decideDriveFile(opts: {
  path: string;
  name: string;
  mimeType: string;
  sizeBytes?: number | null;
  driveModified: Date;
  existing: { sourceModifiedAt: Date | null } | null;
}): DriveFileDecision {
  if (isJunkPath(opts.path) || isJunkPath(opts.name)) return "skip_junk";
  if (!isParsableDriveFile(opts.name, opts.mimeType)) return "skip_unsupported";
  if (opts.sizeBytes && opts.sizeBytes > MAX_DRIVE_FILE_BYTES) return "skip_too_large";
  if (shouldSkipUnchanged(opts.existing, opts.driveModified)) return "skip_unchanged";
  return "process";
}

export function shouldAutoCommit(opts: {
  fileName: string;
  duplicateCount: number;
  total: number;
  defectCount: number;
}): boolean {
  if (opts.duplicateCount > 0) return false;
  if (looksLikeCopy(opts.fileName)) return false;
  return opts.total > 0 || opts.defectCount > 0;
}

/** Next 06:00 America/Bogota. Colombia is UTC-5 with no DST. */
export function nextDriveSyncAt(from = new Date(), timeZone = "America/Bogota"): Date {
  if (timeZone !== "America/Bogota") {
    return nextDriveSyncAt(from, "America/Bogota");
  }
  const target = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 11, 0, 0, 0),
  );
  if (target.getTime() <= from.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target;
}
