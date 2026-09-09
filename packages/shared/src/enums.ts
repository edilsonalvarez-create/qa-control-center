export const ROLES = ["ADMIN", "QA_MANAGER", "QA", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const TEST_TYPES = [
  "UNIT",
  "INTEGRATION",
  "E2E",
  "API",
  "PERFORMANCE",
  "SECURITY",
  "FUNCTIONAL",
  "RTM",
  "BOUNDARY",
  "REGRESSION",
  "SMOKE",
  "UNKNOWN",
] as const;
export type TestType = (typeof TEST_TYPES)[number];

export const ENVIRONMENTS = ["DEV", "QA", "TEST", "STAGING", "PROD", "UNKNOWN"] as const;
export type Environment = (typeof ENVIRONMENTS)[number];

export const CASE_STATUSES = ["PASS", "FAIL", "BLOCKED", "SKIPPED", "UNKNOWN", "REQUIRES_REVIEW"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const DEFECT_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "FIXED",
  "READY_FOR_RETEST",
  "RETEST_FAILED",
  "CLOSED",
  "REOPENED",
] as const;
export type DefectStatus = (typeof DEFECT_STATUSES)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const COVERAGE_STATUSES = ["stable", "observations", "failing", "untested"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const UNKNOWN = "Unknown";
export const REQUIRES_REVIEW = "Requires review";
