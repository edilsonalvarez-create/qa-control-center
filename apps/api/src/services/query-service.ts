import { CaseStatus, DefectStatus, Prisma, Severity } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { dateRange, type FilterQuery } from "../lib/filters.js";

function runWhere(f: FilterQuery): Prisma.TestRunWhereInput {
  const executionDate = dateRange(f.from, f.to);
  return {
    projectId: f.projectId || undefined,
    moduleId: f.moduleId || undefined,
    tester: f.tester ? { contains: f.tester, mode: "insensitive" } : undefined,
    testType: f.testType ? (f.testType as Prisma.EnumTestTypeFilter) : undefined,
    environment: f.environment ? (f.environment as Prisma.EnumEnvironmentFilter) : undefined,
    version: f.version || undefined,
    executionDate,
    status: f.result
      ? f.result === "PASS"
        ? "PASSED"
        : f.result === "FAIL"
          ? "FAILED"
          : f.result === "BLOCKED"
            ? "BLOCKED"
            : undefined
      : undefined,
  };
}

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
  const where = runWhere(f);
  const runs = await prisma.testRun.findMany({
    where,
    include: { testCases: { select: { status: true } } },
  });
  const runTotals = runs.reduce(
    (acc, r) => {
      acc.totalTests += r.totalTests;
      acc.passed += r.passed;
      acc.failed += r.failed;
      acc.blocked += r.blocked;
      acc.skipped += r.skipped;
      acc.runs += 1;
      return acc;
    },
    { totalTests: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, runs: 0 },
  );
  const fromEstado = emptyCaseMix();
  for (const r of runs) {
    for (const c of r.testCases) addCaseStatus(fromEstado, c.status);
  }
  const useEstado = fromEstado.total > 0;
  const totals = {
    totalTests: useEstado ? fromEstado.total : runTotals.totalTests,
    passed: useEstado ? fromEstado.passed : runTotals.passed,
    failed: useEstado ? fromEstado.failed : runTotals.failed,
    blocked: useEstado ? fromEstado.blocked : runTotals.blocked,
    skipped: useEstado ? fromEstado.skipped : runTotals.skipped,
    unknown: useEstado ? fromEstado.unknown : 0,
    review: useEstado ? fromEstado.review : 0,
    runs: runTotals.runs,
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

  const modules = await prisma.module.findMany({
    where: { projectId: f.projectId || undefined },
    include: { testRuns: { orderBy: { executionDate: "desc" }, take: 1 } },
  });
  const tested = modules.filter((m) => m.testRuns.length > 0).length;
  const coveragePct = modules.length ? Math.round((tested / modules.length) * 100) : 0;
  const decided = totals.passed + totals.failed + totals.blocked;
  const successPct = decided ? Math.round((totals.passed / decided) * 100) : null;

  const byDayMap = new Map<
    string,
    { date: string; passed: number; failed: number; blocked: number; skipped: number; unknown: number }
  >();
  for (const r of runs) {
    const key = r.executionDate.toISOString().slice(0, 10);
    const cur = byDayMap.get(key) ?? { date: key, passed: 0, failed: 0, blocked: 0, skipped: 0, unknown: 0 };
    if (r.testCases.length) {
      for (const c of r.testCases) {
        if (c.status === CaseStatus.PASS) cur.passed += 1;
        else if (c.status === CaseStatus.FAIL) cur.failed += 1;
        else if (c.status === CaseStatus.BLOCKED) cur.blocked += 1;
        else if (c.status === CaseStatus.SKIPPED) cur.skipped += 1;
        else cur.unknown += 1;
      }
    } else {
      cur.passed += r.passed;
      cur.failed += r.failed;
      cur.blocked += r.blocked;
      cur.skipped += r.skipped;
    }
    byDayMap.set(key, cur);
  }

  const projects = await prisma.project.findMany({
    include: { testRuns: { include: { testCases: { select: { status: true } } } }, defects: true },
  });

  const byProject = projects.map((p) => {
    const mix = emptyCaseMix();
    for (const r of p.testRuns) {
      if (r.testCases.length) {
        for (const c of r.testCases) addCaseStatus(mix, c.status);
      } else {
        mix.total += r.totalTests;
        mix.passed += r.passed;
        mix.failed += r.failed;
        mix.blocked += r.blocked;
        mix.skipped += r.skipped;
      }
    }
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      product: p.product,
      totalTests: mix.total,
      passed: mix.passed,
      failed: mix.failed,
      blocked: mix.blocked,
      openDefects: p.defects.filter((d) => d.status !== DefectStatus.CLOSED).length,
    };
  });

  const severityCounts = {
    CRITICAL: defects.filter((d) => d.severity === "CRITICAL").length,
    HIGH: defects.filter((d) => d.severity === "HIGH").length,
    MEDIUM: defects.filter((d) => d.severity === "MEDIUM").length,
    LOW: defects.filter((d) => d.severity === "LOW").length,
    UNKNOWN: defects.filter((d) => d.severity === "UNKNOWN").length,
  };

  return {
    empty: totals.runs === 0,
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
      testRuns: { orderBy: { executionDate: "desc" } },
      defects: true,
    },
  });

  return modules.map((m) => {
    const last = m.testRuns[0];
    const total = m.testRuns.reduce((s, r) => s + r.totalTests, 0);
    const passed = m.testRuns.reduce((s, r) => s + r.passed, 0);
    const failed = m.testRuns.reduce((s, r) => s + r.failed, 0);
    const blocked = m.testRuns.reduce((s, r) => s + r.blocked, 0);
    const openDefects = m.defects.filter((d) => d.status !== DefectStatus.CLOSED).length;
    let coverage: "stable" | "observations" | "failing" | "untested" = "untested";
    if (!last) coverage = "untested";
    else if (last.failed > 0 || m.defects.some((d) => d.severity === "CRITICAL" && d.status !== "CLOSED"))
      coverage = "failing";
    else if (last.blocked > 0 || openDefects > 0) coverage = "observations";
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
  });
}

export async function searchAll(q: string) {
  const term = q.trim();
  if (!term) return { testRuns: [], testCases: [], defects: [], evidence: [], reports: [], releases: [] };
  const contains = { contains: term, mode: "insensitive" as const };
  const [testRuns, testCases, defects, evidence, reports, releases] = await Promise.all([
    prisma.testRun.findMany({
      where: { OR: [{ tester: contains }, { observations: contains }, { version: contains }, { commit: contains }] },
      take: 20,
      include: { project: true, module: true },
    }),
    prisma.testCase.findMany({
      where: { OR: [{ title: contains }, { description: contains }, { externalId: contains }] },
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

export { runWhere };
export { CaseStatus };
