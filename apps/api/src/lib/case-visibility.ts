import { CaseStatus, Prisma } from "@prisma/client";
import {
  EXECUTED_CASE_STATUSES,
  hasCaseInformation,
  isExecutedStatus,
  isListableCase,
  isPendingStatus,
  isPlaceholderTitle,
  PLACEHOLDER_TITLES,
} from "./case-info.js";
import { prisma } from "./prisma.js";
import { dateRange, type FilterQuery } from "./filters.js";

export {
  EXECUTED_CASE_STATUSES,
  hasCaseInformation,
  isExecutedStatus,
  isListableCase,
  isPendingStatus,
  isPlaceholderTitle,
};

export function emptyCaseWhere(): Prisma.TestCaseWhereInput {
  return {
    OR: [
      { title: "" },
      {
        AND: [
          { title: { in: PLACEHOLDER_TITLES } },
          { OR: [{ externalId: null }, { externalId: "" }] },
        ],
      },
    ],
  };
}

export function informativeCaseWhere(): Prisma.TestCaseWhereInput {
  return { NOT: emptyCaseWhere() };
}

export function listableCaseWhere(): Prisma.TestCaseWhereInput {
  return {
    AND: [informativeCaseWhere(), { status: { in: EXECUTED_CASE_STATUSES } }],
  };
}

/**
 * Test Runs / Test Cases / run detail / Matriz filters: every case that has
 * real information, including imported Matriz QA rows that are still pending
 * (UNKNOWN / REQUIRES_REVIEW). listableCaseWhere stays executed-only so
 * Coverage does not treat "not yet run" as coverage.
 */
export function panelCaseWhere(): Prisma.TestCaseWhereInput {
  return informativeCaseWhere();
}

export function pendingCaseWhere(): Prisma.TestCaseWhereInput {
  return {
    AND: [informativeCaseWhere(), { status: CaseStatus.UNKNOWN }],
  };
}

function runScopeWhere(f: FilterQuery): Prisma.TestRunWhereInput {
  return {
    projectId: f.projectId || undefined,
    tester: f.tester ? { contains: f.tester, mode: "insensitive" } : undefined,
    testType: f.testType ? (f.testType as Prisma.EnumTestTypeFilter) : undefined,
    environment: f.environment ? (f.environment as Prisma.EnumEnvironmentFilter) : undefined,
    version: f.version || undefined,
    executionDate: dateRange(f.from, f.to),
  };
}

async function moduleMatch(f: FilterQuery): Promise<Prisma.TestCaseWhereInput> {
  if (!f.moduleId) return {};
  const mod = await prisma.module.findUnique({ where: { id: f.moduleId }, select: { name: true } });
  return {
    OR: [{ testRun: { moduleId: f.moduleId } }, ...(mod?.name ? [{ moduleName: mod.name }] : [])],
  };
}

export type CaseVisibility = "listable" | "informative" | "pending" | "panel";

function visibilityWhere(visibility: CaseVisibility): Prisma.TestCaseWhereInput {
  if (visibility === "listable") return listableCaseWhere();
  if (visibility === "pending") return pendingCaseWhere();
  if (visibility === "panel") return panelCaseWhere();
  return informativeCaseWhere();
}

export async function caseWhere(f: FilterQuery, visibility: CaseVisibility): Promise<Prisma.TestCaseWhereInput> {
  const vis = visibilityWhere(visibility);
  const result =
    f.result && EXECUTED_CASE_STATUSES.includes(f.result as CaseStatus)
      ? { status: f.result as CaseStatus }
      : {};
  return {
    AND: [vis, result, { testRun: runScopeWhere(f) }, await moduleMatch(f)],
  };
}

export async function runListWhere(
  f: FilterQuery,
  visibility: CaseVisibility = "listable",
): Promise<Prisma.TestRunWhereInput> {
  const caseMatch: Prisma.TestCaseWhereInput = {
    AND: [
      visibilityWhere(visibility),
      f.result && EXECUTED_CASE_STATUSES.includes(f.result as CaseStatus)
        ? { status: f.result as CaseStatus }
        : {},
    ],
  };
  const moduleClause: Prisma.TestRunWhereInput = f.moduleId
    ? {
        OR: [{ moduleId: f.moduleId }, { testCases: { some: { AND: [caseMatch, await moduleMatch(f)] } } }],
      }
    : {};
  return {
    AND: [runScopeWhere(f), { testCases: { some: caseMatch } }, moduleClause],
  };
}
