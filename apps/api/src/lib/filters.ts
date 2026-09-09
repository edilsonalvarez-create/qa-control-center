import type { FastifyRequest } from "fastify";

export type FilterQuery = {
  projectId?: string;
  moduleId?: string;
  tester?: string;
  testType?: string;
  environment?: string;
  result?: string;
  severity?: string;
  version?: string;
  from?: string;
  to?: string;
  q?: string;
};

export function parseFilters(request: FastifyRequest): FilterQuery {
  const q = request.query as Record<string, string | undefined>;
  return {
    projectId: q.projectId,
    moduleId: q.moduleId,
    tester: q.tester,
    testType: q.testType,
    environment: q.environment,
    result: q.result,
    severity: q.severity,
    version: q.version,
    from: q.from,
    to: q.to,
    q: q.q,
  };
}

export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    gte: from ? new Date(from) : undefined,
    lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
  };
}
