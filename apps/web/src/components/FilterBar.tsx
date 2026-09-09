import { useEffect, useState } from "react";
import { api, toQuery } from "../lib/api";
import { useFilters } from "../lib/filters";

type Project = { id: string; name: string };
type Module = { id: string; name: string; projectId: string };

export function FilterBar() {
  const { filters, setFilters } = useFilters();
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    api<Project[]>("/api/v1/projects").then(setProjects).catch(() => setProjects([]));
  }, []);
  useEffect(() => {
    api<Module[]>(`/api/v1/modules${toQuery({ projectId: filters.projectId })}`)
      .then(setModules)
      .catch(() => setModules([]));
  }, [filters.projectId]);

  const set = (k: string, v: string) => setFilters({ ...filters, [k]: v || undefined });

  return (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-ink-900">
      <select className="filter" value={filters.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)}>
        <option value="">Proyecto</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select className="filter" value={filters.moduleId ?? ""} onChange={(e) => set("moduleId", e.target.value)}>
        <option value="">Módulo</option>
        {modules.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <input className="filter" type="date" value={filters.from ?? ""} onChange={(e) => set("from", e.target.value)} />
      <input className="filter" type="date" value={filters.to ?? ""} onChange={(e) => set("to", e.target.value)} />
      <input className="filter w-32" placeholder="QA" value={filters.tester ?? ""} onChange={(e) => set("tester", e.target.value)} />
      <select className="filter" value={filters.testType ?? ""} onChange={(e) => set("testType", e.target.value)}>
        <option value="">Tipo</option>
        {["FUNCTIONAL", "E2E", "RTM", "BOUNDARY", "REGRESSION", "UNKNOWN"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select className="filter" value={filters.environment ?? ""} onChange={(e) => set("environment", e.target.value)}>
        <option value="">Ambiente</option>
        {["DEV", "QA", "TEST", "STAGING", "PROD", "UNKNOWN"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select className="filter" value={filters.result ?? ""} onChange={(e) => set("result", e.target.value)}>
        <option value="">Resultado</option>
        {["PASS", "FAIL", "BLOCKED", "SKIPPED"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <select className="filter" value={filters.severity ?? ""} onChange={(e) => set("severity", e.target.value)}>
        <option value="">Severidad</option>
        {["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </select>
      <button className="text-xs text-slate-500" onClick={() => setFilters({})}>
        Limpiar
      </button>
      <style>{`
        .filter { border-radius: 0.75rem; border: 1px solid rgb(226 232 240); background: rgb(248 250 252); padding: 0.35rem 0.6rem; font-size: 0.75rem; }
        .dark .filter { border-color: rgb(51 65 85); background: rgb(15 23 42); color: white; }
      `}</style>
    </div>
  );
}
