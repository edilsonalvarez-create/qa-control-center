import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, toQuery } from "../lib/api";
import { useFilters } from "../lib/filters";
import { useCatalogOptions } from "../hooks/useCatalogOptions";

type Project = { id: string; name: string };
type Module = { id: string; name: string; projectId: string };

/** Used only when the catalog has no values for that category yet. */
const FALLBACK = {
  TEST_TYPE: ["FUNCTIONAL", "E2E", "RTM", "BOUNDARY", "REGRESSION", "UNKNOWN"],
  ENVIRONMENT: ["DEV", "QA", "TEST", "STAGING", "PROD", "UNKNOWN"],
  EXEC_STATUS: ["PASS", "FAIL", "BLOCKED", "SKIPPED"],
  SEVERITY: ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"],
};

function optionsFor(catalog: string[] | undefined, fallback: string[], current?: string) {
  const list = catalog?.length ? catalog : fallback;
  return current && !list.includes(current) ? [current, ...list] : list;
}

export function FilterBar() {
  const { filters, setFilters } = useFilters();
  const { pathname } = useLocation();
  const scope = pathname === "/" ? "informative" : pathname === "/matrix" || pathname === "/cases" || pathname.startsWith("/runs") ? "panel" : "executed";
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [modulesReady, setModulesReady] = useState(false);
  const { byCategory } = useCatalogOptions();

  useEffect(() => {
    api<Project[]>(`/api/v1/projects${toQuery({ scope })}`)
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [scope]);
  useEffect(() => {
    setModulesReady(false);
    api<Module[]>(`/api/v1/modules${toQuery({ projectId: filters.projectId, scope })}`)
      .then((rows) => {
        setModules(rows);
        setModulesReady(true);
      })
      .catch(() => {
        setModules([]);
        setModulesReady(true);
      });
  }, [filters.projectId, scope]);

  useEffect(() => {
    if (!modulesReady) return;
    if (filters.moduleId && !modules.some((m) => m.id === filters.moduleId)) {
      setFilters({ ...filters, moduleId: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulesReady, modules, scope]);

  const set = (k: string, v: string) => setFilters({ ...filters, [k]: v || undefined });
  const cls = (active: unknown) => (active ? "filter filter-active" : "filter");

  const types = optionsFor(byCategory.get("TEST_TYPE"), FALLBACK.TEST_TYPE, filters.testType);
  const envs = optionsFor(byCategory.get("ENVIRONMENT"), FALLBACK.ENVIRONMENT, filters.environment);
  const results = optionsFor(byCategory.get("EXEC_STATUS"), FALLBACK.EXEC_STATUS, filters.result);
  const sevs = optionsFor(byCategory.get("SEVERITY"), FALLBACK.SEVERITY, filters.severity);

  // Filters live in one shared context for the whole app (see lib/filters.tsx)
  // so they carry over silently across unrelated pages/modules — surface how
  // many are active and highlight which ones, so a leftover filter from
  // another page never again looks like "this module isn't updating".
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-ink-900">
      {activeCount > 0 && (
        <p className="mb-2 text-xs font-medium text-cyan-700 dark:text-cyan-400">
          {activeCount} {activeCount === 1 ? "filtro activo" : "filtros activos"} — se aplican en todas las páginas
          hasta que los limpies.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <select className={cls(filters.projectId)} value={filters.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)}>
          <option value="">Proyecto</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className={cls(filters.moduleId)} value={filters.moduleId ?? ""} onChange={(e) => set("moduleId", e.target.value)}>
          <option value="">Módulo</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input className={cls(filters.from)} type="date" value={filters.from ?? ""} onChange={(e) => set("from", e.target.value)} />
        <input className={cls(filters.to)} type="date" value={filters.to ?? ""} onChange={(e) => set("to", e.target.value)} />
        <input className={`${cls(filters.tester)} w-32`} placeholder="QA" value={filters.tester ?? ""} onChange={(e) => set("tester", e.target.value)} />
        <select className={cls(filters.testType)} value={filters.testType ?? ""} onChange={(e) => set("testType", e.target.value)}>
          <option value="">Tipo</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className={cls(filters.environment)} value={filters.environment ?? ""} onChange={(e) => set("environment", e.target.value)}>
          <option value="">Ambiente</option>
          {envs.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className={cls(filters.result)} value={filters.result ?? ""} onChange={(e) => set("result", e.target.value)}>
          <option value="">Resultado</option>
          {results.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select className={cls(filters.severity)} value={filters.severity ?? ""} onChange={(e) => set("severity", e.target.value)}>
          <option value="">Severidad</option>
          {sevs.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          className={
            activeCount > 0
              ? "rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white"
              : "text-xs text-slate-400"
          }
          disabled={!activeCount}
          onClick={() => setFilters({})}
        >
          Limpiar{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
      </div>
      <style>{`
        .filter { border-radius: 0.75rem; border: 1px solid rgb(226 232 240); background: rgb(248 250 252); padding: 0.35rem 0.6rem; font-size: 0.75rem; }
        .dark .filter { border-color: rgb(51 65 85); background: rgb(15 23 42); color: white; }
        .filter-active { border-color: rgb(8 145 178); background: rgb(207 250 254); font-weight: 600; }
        .dark .filter-active { border-color: rgb(34 211 238); background: rgb(8 51 68); color: rgb(207 250 254); }
      `}</style>
    </div>
  );
}
