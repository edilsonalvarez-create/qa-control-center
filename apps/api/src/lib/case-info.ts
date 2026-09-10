import { CaseStatus } from "@prisma/client";

const PLACEHOLDER_TITLES = ["Requires review", "Unknown", "—", "-", "N/A", "n/a", "NA"];

export const EXECUTED_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.PASS,
  CaseStatus.FAIL,
  CaseStatus.BLOCKED,
  CaseStatus.SKIPPED,
];

export function isPlaceholderTitle(title?: string | null): boolean {
  const t = (title ?? "").trim();
  if (!t) return true;
  return PLACEHOLDER_TITLES.some((p) => p.toLowerCase() === t.toLowerCase());
}

export function hasCaseInformation(c: { title?: string | null; externalId?: string | null }): boolean {
  if ((c.externalId ?? "").trim()) return true;
  return !isPlaceholderTitle(c.title);
}

export function isExecutedStatus(status: CaseStatus | string): boolean {
  return EXECUTED_CASE_STATUSES.includes(status as CaseStatus);
}

export function isPendingStatus(status: CaseStatus | string): boolean {
  return status === CaseStatus.UNKNOWN;
}

export function isListableCase(c: {
  title?: string | null;
  externalId?: string | null;
  status: CaseStatus | string;
}): boolean {
  return hasCaseInformation(c) && isExecutedStatus(c.status);
}

export { PLACEHOLDER_TITLES };
