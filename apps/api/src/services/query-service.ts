import { CaseStatus, DefectStatus, Prisma, Severity } from "@prisma/client";
import {
  caseWhere,
  isExecutedStatus,
  isPendingStatus,
  listableCaseWhere,
} from "../lib/case-visibility.js";
import { prisma } from "../lib/prisma.js";
import { type FilterQuery } from "../lib/filters.js";

function emptyCaseMix() {
  return { passed: 0, failed: 0, blocked: 0, skipped: 0, unknown: 0, review: 0, total: 0 };
}

function addCaseStatus(
  acc: ReturnType<typeof emptyCaseMix>,
  status: CaseStatus,
  n = 1,
) {
  acc.total += n;
  if (status === CaseStatus.PASS) acc.passed += n;
  else if (status === CaseStatus.FAIL) acc.failed += n;
  else if (status === CaseStatus.BLOCKED) acc.blocked += n;
  else if (status === CaseStatus.SKIPPED) acc.skipped += n;
  else if (status === CaseStatus.REQUIRES_REVIEW) acc.review += n;
  else acc.unknown += n;
}

export async function getDashboard(f: FilterQuery) {
  const cases = await prisma.testCase.findMany({
    where: await caseWhere(f, "informative"),
    select: {
      status: true,
      testRunId: true,
      moduleName: true,
      testRun: {
        select: {
          executionDate: true,
          projectId: true,
          moduleId: true,
          project: { select: { id: true, name: true, status: true, product: true } },
        },
      },
    },
  });
  const fromEstado = emptyCaseMix();
  for (const c of cases) addCaseStatus(fromEstado, c.status);
  const executedRunIds = new Set(cases.filter((c) => isExecutedStatus(c.status)).map((c) => c.testRunId));
  const totals = {
    totalTests: fromEstado.total,
    passed: fromEstado.passed,
    failed: fromEstado.failed,
    blocked: fromEstado.blocked,
    skipped: fromEstado.skipped,
    unknown: fromEstado.unknown,
    review: fromEstado.review,
    runs: executedRunIds.size,
  };

  const defectWhere: Prisma.DefectWhereInput = {
    projectId: f.projectId || undefined,
    moduleId: f.moduleId || undefined,
    severity: f.severity ? (f.severity as Severity) : undefined,
  };
  const defects = await prisma.defect.findMany({ where: defectWhere });
  const openStatuses = new Set<DefectStatus>([
    DefectStatus.OPEN,
    DefectStatus.IN_PROGRESS,
    DefectStatus.REOPENED,
    DefectStatus.RETEST_FAILED,
  ]);
  const open = defects.filter((d) => openStatuses.has(d.status));
  const critical = defects.filter((d) => d.severity === Severity.CRITICAL);
  const retest = defects.filter((d) => d.status === DefectStatus.READY_FOR_RETEST);

  const decided = totals.passed + totals.failed + totals.blocked;
  const successPct = decided ? Math.round((totals.passed / decided) * 100) : null;

  const byDayMap = new Map<
    string,
    { date: string; passed: number; failed: number; blocked: number; skipped: number; unknown: number }
  >();
  for (const c of cases) {
    const key = c.testRun.executionDate.toISOString().slice(0, 10);
    const cur = byDayMap.get(key) ?? { date: key, passed: 0, failed: 0, blocked: 0, skipped: 0, unknown: 0 };
    if (c.status === CaseStatus.PASS) cur.passed += 1;
    else if (c.status === CaseStatus.FAIL) cur.failed += 1;
    else if (c.status === CaseStatus.BLOCKED) cur.blocked += 1;
    else if (c.status === CaseStatus.SKIPPED) cur.skipped += 1;
    else if (isPendingStatus(c.status) || c.status === CaseStatus.REQUIRES_REVIEW) cur.unknown += 1;
    byDayMap.set(key, cur);
  }

  const projectMix = new Map<
    string,
    {
      id: string;
      name: string;
      status: string;
      product: string | null;
      mix: ReturnType<typeof emptyCaseMix>;
    }
  >();
  for (const c of cases) {
    const p = c.testRun.project;
    const cur = projectMix.get(p.id) ?? {
      id: p.id,
      name: p.name,
      status: p.status,
      product: p.product,
      mix: emptyCaseMix(),
    };
    addCaseStatus(cur.mix, c.status);
    projectMix.set(p.id, cur);
  }
  const projectIds = [...projectMix.keys()];
  const projectDefects = projectIds.length
    ? await prisma.defect.findMany({
        where: { projectId: { in: projectIds } },
        select: { projectId: true, status: true },
      })
    : [];
  const openByProject = new Map<string, number>();
  for (const d of projectDefects) {
    if (d.status === DefectStatus.CLOSED) continue;
    openByProject.set(d.projectId, (openByProject.get(d.projectId) ?? 0) + 1);
  }
  const byProject = [...projectMix.values()].map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    product: p.product,
    totalTests: p.mix.total,
    passed: p.mix.passed,
    failed: p.mix.failed,
    blocked: p.mix.blocked,
    openDefects: openByProject.get(p.id) ?? 0,
  }));

  const moduleKey = (c: (typeof cases)[number]) => c.testRun.moduleId || c.moduleName || "";
  const informativeModuleCount = new Set(cases.map(moduleKey).filter(Boolean)).size;
  const testedModuleCount = new Set(cases.filter((c) => isExecutedStatus(c.status)).map(moduleKey).filter(Boolean)).size;
  const coveragePct = informativeModuleCount ? Math.round((testedModuleCount / informativeModuleCount) * 100) : 0;

  const severityCounts = {
    CRITICAL: defects.filter((d) => d.severity === "CRITICAL").length,
    HIGH: defects.filter((d) => d.severity === "HIGH").length,
    MEDIUM: defects.filter((d) => d.severity === "MEDIUM").length,
    LOW: defects.filter((d) => d.severity === "LOW").length,
    UNKNOWN: defects.filter((d) => d.severity === "UNKNOWN").length,
  };

  return {
    empty: cases.length === 0,
    kpis: {
      totalTests: totals.totalTests,
      executedRuns: totals.runs,
      passed: totals.passed,
      failed: totals.failed,
      blocked: totals.blocked,
      skipped: totals.skipped,
      unknown: totals.unknown,
      review: totals.review,
      defectsFound: defects.length,
      defectsOpen: open.length,
      defectsCritical: critical.length,
      defectsRetest: retest.length,
      coveragePct,
      successPct,
    },
    byDay: [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    resultMix: {
      PASS: totals.passed,
      FAIL: totals.failed,
      BLOCKED: totals.blocked,
      SKIPPED: totals.skipped,
      UNKNOWN: totals.unknown,
      REQUIRES_REVIEW: totals.review,
    },
    byProject,
    severityCounts,
  };
}

export async function getCoverage(f: FilterQuery) {
  const modules = await prisma.module.findMany({
    where: {
      projectId: f.projectId || undefined,
      id: f.moduleId || undefined,
    },
    include: {
      project: true,
      testRuns: {
        orderBy: { executionDate: "desc" },
        include: { testCases: { where: listableCaseWhere(), select: { status: true } } },
      },
      defects: true,
    },
  });

  return modules
    .map((m) => {
      const executedRuns = m.testRuns.filter((r) => r.testCases.length > 0);
      const last = executedRuns[0];
      const total = executedRuns.reduce((s, r) => s + r.testCases.length, 0);
      const passed = executedRuns.reduce((s, r) => s + r.testCases.filter((c) => c.status === CaseStatus.PASS).length, 0);
      const failed = executedRuns.reduce((s, r) => s + r.testCases.filter((c) => c.status === CaseStatus.FAIL).length, 0);
      const blocked = executedRuns.reduce(
        (s, r) => s + r.testCases.filter((c) => c.status === CaseStatus.BLOCKED).length,
        0,
      );
      const openDefects = m.defects.filter((d) => d.status !== DefectStatus.CLOSED).length;
      let coverage: "stable" | "observations" | "failing" | "untested" = "untested";
      if (!last) coverage = "untested";
      else if (failed > 0 || m.defects.some((d) => d.severity === "CRITICAL" && d.status !== "CLOSED"))
        coverage = "failing";
      else if (blocked > 0 || openDefects > 0) coverage = "observations";
      else coverage = "stable";
      return {
        projectId: m.projectId,
        project: m.project.name,
        moduleId: m.id,
        module: m.name,
        functionality: m.name,
        tests: total,
        lastRun: last?.executionDate ?? null,
        lastResult: last?.status ?? "UNTESTED",
        defects: openDefects,
        passed,
        failed,
        blocked,
        successPct: total ? Math.round((passed / total) * 100) : null,
        coverage,
      };
    })
    .filter((r) => r.tests > 0);
}

export async function searchAll(q: string) {
  const term = q.trim();
  if (!term) return { testRuns: [], testCases: [], defects: [], evidence: [], reports: [], releases: [] };
  const contains = { contains: term, mode: "insensitive" as const };
  const [testRuns, testCases, defects, evidence, reports, releases] = await Promise.all([
    prisma.testRun.findMany({
      where: {
        AND: [
          { testCases: { some: listableCaseWhere() } },
          { OR: [{ tester: contains }, { observations: contains }, { version: contains }, { commit: contains }] },
        ],
      },
      take: 20,
      include: { project: true, module: true },
    }),
    prisma.testCase.findMany({
      where: {
        AND: [
          listableCaseWhere(),
          { OR: [{ title: contains }, { description: contains }, { externalId: contains }] },
        ],
      },
      take: 20,
      include: { testRun: { include: { project: true } } },
    }),
    prisma.defect.findMany({
      where: { OR: [{ title: contains }, { description: contains }, { resolution: contains }] },
      take: 20,
      include: { project: true, module: true },
    }),
    prisma.evidence.findMany({
      where: { OR: [{ fileName: contains }, { description: contains }, { fileUrl: contains }] },
      take: 20,
    }),
    prisma.qaReport.findMany({
      where: { OR: [{ fileName: contains }, { summary: contains }] },
      take: 20,
    }),
    prisma.release.findMany({
      where: { OR: [{ version: contains }, { commit: contains }, { notes: contains }] },
      take: 20,
    }),
  ]);
  return { testRuns, testCases, defects, evidence, reports, releases };
}

export { runListWhere } from "../lib/case-visibility.js";
export { CaseStatus };
