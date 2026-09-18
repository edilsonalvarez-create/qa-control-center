import { CaseStatus, DefectStatus, Prisma, Severity } from "@prisma/client";
import {
  caseWhere,
  listableCaseWhere,
  moduleMatch,
  panelCaseWhere,
  runScopeWhere,
} from "../lib/case-visibility.js";
import { EXECUTED_CASE_STATUSES } from "../lib/case-info.js";
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

/**
 * A run's numbers come from its linked sheet when it has one: the sheet is the
 * record of what was actually executed, while the registered cases may be a
 * single summary row. Runs without a sheet are still counted case by case.
 */
export function mixFromRunCounters(run: {
  totalTests: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
}) {
  const mix = emptyCaseMix();
  addCaseStatus(mix, CaseStatus.PASS, run.passed);
  addCaseStatus(mix, CaseStatus.FAIL, run.failed);
  addCaseStatus(mix, CaseStatus.BLOCKED, run.blocked);
  addCaseStatus(mix, CaseStatus.SKIPPED, run.skipped);
  const decided = run.passed + run.failed + run.blocked + run.skipped;
  addCaseStatus(mix, CaseStatus.UNKNOWN, Math.max(0, run.totalTests - decided));
  return mix;
}

/** The case query applies `result` itself; sheet-backed runs must be narrowed here. */
export function narrowToResult(mix: ReturnType<typeof emptyCaseMix>, result: CaseStatus) {
  const only = emptyCaseMix();
  const n =
    result === CaseStatus.PASS
      ? mix.passed
      : result === CaseStatus.FAIL
        ? mix.failed
        : result === CaseStatus.BLOCKED
          ? mix.blocked
          : mix.skipped;
  addCaseStatus(only, result, n);
  return only;
}

function addMix(acc: ReturnType<typeof emptyCaseMix>, m: ReturnType<typeof emptyCaseMix>) {
  acc.total += m.total;
  acc.passed += m.passed;
  acc.failed += m.failed;
  acc.blocked += m.blocked;
  acc.skipped += m.skipped;
  acc.unknown += m.unknown;
  acc.review += m.review;
}

function isExecutedMix(m: ReturnType<typeof emptyCaseMix>) {
  return m.passed + m.failed + m.blocked + m.skipped > 0;
}

export async function getDashboard(f: FilterQuery) {
  const moduleClause: Prisma.TestRunWhereInput = f.moduleId
    ? { OR: [{ moduleId: f.moduleId }, { testCases: { some: await moduleMatch(f) } }] }
    : {};

  const [runs, cases] = await Promise.all([
    prisma.testRun.findMany({
      where: { AND: [runScopeWhere(f), moduleClause] },
      select: {
        id: true,
        executionDate: true,
        moduleId: true,
        evidenceUrl: true,
        totalTests: true,
        passed: true,
        failed: true,
        blocked: true,
        skipped: true,
        project: { select: { id: true, name: true, status: true, product: true } },
      },
    }),
    prisma.testCase.findMany({
      where: await caseWhere(f, "informative"),
      select: { status: true, testRunId: true, moduleName: true },
    }),
  ]);

  const casesByRun = new Map<string, typeof cases>();
  for (const c of cases) {
    const list = casesByRun.get(c.testRunId) ?? [];
    list.push(c);
    casesByRun.set(c.testRunId, list);
  }

  const narrow =
    f.result && EXECUTED_CASE_STATUSES.includes(f.result as CaseStatus) ? (f.result as CaseStatus) : undefined;

  const perRun = runs.map((run) => {
    const own = casesByRun.get(run.id) ?? [];
    let mix = emptyCaseMix();
    if (run.evidenceUrl) {
      mix = mixFromRunCounters(run);
      if (narrow) mix = narrowToResult(mix, narrow);
    } else {
      for (const c of own) addCaseStatus(mix, c.status);
    }
    const moduleKey = run.moduleId || own.find((c) => c.moduleName)?.moduleName || "";
    return { run, mix, moduleKey };
  });

  const counted = perRun.filter((p) => p.mix.total > 0);

  const totals = emptyCaseMix();
  for (const p of counted) addMix(totals, p.mix);
  const executedRuns = counted.filter((p) => isExecutedMix(p.mix)).length;

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
  for (const p of counted) {
    const key = p.run.executionDate.toISOString().slice(0, 10);
    const cur = byDayMap.get(key) ?? { date: key, passed: 0, failed: 0, blocked: 0, skipped: 0, unknown: 0 };
    cur.passed += p.mix.passed;
    cur.failed += p.mix.failed;
    cur.blocked += p.mix.blocked;
    cur.skipped += p.mix.skipped;
    cur.unknown += p.mix.unknown + p.mix.review;
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
  for (const p of counted) {
    const proj = p.run.project;
    const cur = projectMix.get(proj.id) ?? {
      id: proj.id,
      name: proj.name,
      status: proj.status,
      product: proj.product,
      mix: emptyCaseMix(),
    };
    addMix(cur.mix, p.mix);
    projectMix.set(proj.id, cur);
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

  const informativeModuleCount = new Set(counted.map((p) => p.moduleKey).filter(Boolean)).size;
  const testedModuleCount = new Set(
    counted
      .filter((p) => isExecutedMix(p.mix))
      .map((p) => p.moduleKey)
      .filter(Boolean),
  ).size;
  const coveragePct = informativeModuleCount ? Math.round((testedModuleCount / informativeModuleCount) * 100) : 0;

  const severityCounts = {
    CRITICAL: defects.filter((d) => d.severity === "CRITICAL").length,
    HIGH: defects.filter((d) => d.severity === "HIGH").length,
    MEDIUM: defects.filter((d) => d.severity === "MEDIUM").length,
    LOW: defects.filter((d) => d.severity === "LOW").length,
    UNKNOWN: defects.filter((d) => d.severity === "UNKNOWN").length,
  };

  return {
    empty: counted.length === 0,
    kpis: {
      totalTests: totals.total,
      executedRuns,
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
          { testCases: { some: panelCaseWhere() } },
          { OR: [{ tester: contains }, { observations: contains }, { version: contains }, { commit: contains }] },
        ],
      },
      take: 20,
      include: { project: true, module: true },
    }),
    prisma.testCase.findMany({
      where: {
        AND: [
          panelCaseWhere(),
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
