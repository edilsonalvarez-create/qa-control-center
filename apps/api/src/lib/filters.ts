import type { FastifyRequest } from "fastify";
import { asCase, asEnv, asSev, asTestType } from "../parsers/enums.js";
import { mapSeverity, mapStatus } from "../parsers/normalize.js";

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

function present(value?: string): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

/**
 * Catalog / FilterBar may send Spanish labels ("Alta", "Funcional"). Persist
 * and query always use Prisma enums — map at the HTTP boundary so a newly
 * added catalog value still filters the same rows the matrix wrote.
 */
export function normalizeFilterQuery(f: FilterQuery): FilterQuery {
  return {
    ...f,
    testType: f.testType ? asTestType(f.testType) : undefined,
    environment: f.environment ? asEnv(f.environment) : undefined,
    result: f.result ? asCase(mapStatus(f.result)) : undefined,
    severity: f.severity ? asSev(mapSeverity(f.severity)) : undefined,
  };
}

export function parseFilters(request: FastifyRequest): FilterQuery {
  const q = request.query as Record<string, string | undefined>;
  return normalizeFilterQuery({
    projectId: present(q.projectId),
    moduleId: present(q.moduleId),
    tester: present(q.tester),
    testType: present(q.testType),
    environment: present(q.environment),
    result: present(q.result),
    severity: present(q.severity),
    version: present(q.version),
    from: present(q.from),
    to: present(q.to),
    q: present(q.q),
  });
}

export function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    gte: from ? new Date(from) : undefined,
    lte: to ? new Date(`${to}T23:59:59.999Z`) : undefined,
  };
}
