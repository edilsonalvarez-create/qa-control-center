import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, API_URL, getToken, toQuery } from "../lib/api";
import { useFilters } from "../lib/filters";
import { CoverageDot, StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";

function useApiList<T>(path: string, deps: unknown[] = []) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api<T[]>(path)
      .then(setRows)
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { rows, error };
}

export function RunsPage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/test-runs${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  if (!rows.length) return <EmptyState title="Sin test runs" hint="Importa una matriz o reporte desde Import Center." />;
  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-bold">Test Runs</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Fecha</th>
            <th>Proyecto</th>
            <th>Módulo</th>
            <th>Tipo</th>
            <th>Env</th>
            <th>Total</th>
            <th>P/F/B/S</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
              <td className="py-2">
                <Link className="text-cyan-700 dark:text-cyan-400" to={`/runs/${r.id}`}>
                  {new Date(r.executionDate).toLocaleDateString()}
                </Link>
              </td>
              <td>{r.project?.name}</td>
              <td>{r.module?.name ?? "—"}</td>
              <td>{r.testType}</td>
              <td>{r.environment}</td>
              <td>{r.totalTests}</td>
              <td>
                {r.passed}/{r.failed}/{r.blocked}/{r.skipped}
              </td>
              <td>
                <StatusBadge value={r.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CasesPage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/test-cases${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-bold">Test Cases</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>ID</th>
            <th>Título</th>
            <th>Proyecto</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800">
              <td className="py-2">{c.externalId ?? "—"}</td>
              <td>{c.title}</td>
              <td>{c.testRun?.project?.name}</td>
              <td>
                <StatusBadge value={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DefectsPage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/defects${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-bold">Defects</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th>Título</th>
            <th>Proyecto</th>
            <th>Módulo</th>
            <th>Severidad</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-t border-slate-200 dark:border-slate-800">
              <td className="py-2">{d.title}</td>
              <td>{d.project?.name}</td>
              <td>{d.module?.name ?? "—"}</td>
              <td>
                <StatusBadge value={d.severity} />
              </td>
              <td>
                <StatusBadge value={d.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoveragePage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/coverage${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  return (
    <div className="card overflow-x-auto">
      <h2 className="mb-3 text-xl font-bold">QA Coverage</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th></th>
            <th>Proyecto</th>
            <th>Módulo</th>
            <th>Tests</th>
            <th>Última</th>
            <th>Resultado</th>
            <th>Defectos</th>
            <th>Éxito</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.moduleId} className="border-t border-slate-200 dark:border-slate-800">
              <td className="py-2">
                <CoverageDot status={r.coverage} />
              </td>
              <td>{r.project}</td>
              <td>{r.module}</td>
              <td>{r.tests}</td>
              <td>{r.lastRun ? new Date(r.lastRun).toLocaleDateString() : "—"}</td>
              <td>
                <StatusBadge value={r.lastResult} />
              </td>
              <td>{r.defects}</td>
              <td>{r.successPct ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidencePage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/evidence${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Evidence</h2>
      <p className="text-sm text-slate-500">Referencias al archivo original. No se duplican binarios de Drive.</p>
      {rows.map((e) => (
        <div key={e.id} className="card">
          <p className="font-medium">{e.fileName}</p>
          <p className="text-xs text-slate-500">{e.description}</p>
          {e.fileUrl && (
            <a className="text-sm text-cyan-700 dark:text-cyan-400" href={e.fileUrl} target="_blank" rel="noreferrer">
              Abrir original
            </a>
          )}
          {e.fileUrl?.toLowerCase().includes(".pdf") && (
            <iframe title={e.fileName} src={e.fileUrl} className="mt-3 h-64 w-full rounded-xl border border-slate-200 dark:border-slate-800" />
          )}
        </div>
      ))}
    </div>
  );
}

export function TimelinePage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/timeline${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const key = new Date(r.executionDate).toISOString().slice(0, 7);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Timeline</h2>
      {[...groups.entries()].map(([month, items]) => (
        <div key={month}>
          <h3 className="mb-2 font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">{month}</h3>
          <ol className="border-l border-slate-300 pl-4 dark:border-slate-700">
            {items.map((r) => (
              <li key={r.id} className="mb-4">
                <p className="text-xs text-slate-500">{new Date(r.executionDate).toLocaleDateString()}</p>
                <Link to={`/runs/${r.id}`} className="font-medium">
                  {r.testType} — {r.project?.name} {r.module?.name ? `· ${r.module.name}` : ""}
                </Link>
                <div className="mt-1">
                  <StatusBadge value={r.status} />{" "}
                  <span className="text-xs">
                    {r.passed}P / {r.failed}F / {r.blocked}B
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function ReleasesPage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/releases${toQuery(query)}`, [query]);
  if (error) return <p className="text-rose-500">{error}</p>;
  return (
    <div className="card">
      <h2 className="mb-2 text-xl font-bold">Releases</h2>
      <p className="mb-4 text-sm text-slate-500">Health GO / CONDITIONAL GO / NO-GO se calcula cuando existan smoke+regresión importados. Sin datos: Unknown.</p>
      {!rows.length && <p className="text-sm">Sin releases registrados aún.</p>}
      {rows.map((r) => (
        <div key={r.id} className="border-t border-slate-200 py-3 dark:border-slate-800">
          <p className="font-medium">
            {r.project?.name} {r.version} <StatusBadge value={r.health} />
          </p>
          <p className="text-xs text-slate-500">
            {r.environment} · {r.commit ?? "Unknown"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function ReportsPage() {
  const { query } = useFilters();
  const { rows, error } = useApiList<any>(`/api/v1/reports${toQuery(query)}`, [query]);
  async function exportCsv() {
    const res = await fetch(`${API_URL}/api/v1/reports/export${toQuery(query)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qa-report.csv";
    a.click();
  }
  if (error) return <p className="text-rose-500">{error}</p>;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Reports</h2>
        <button className="rounded-xl bg-cyan-600 px-4 py-2 text-sm text-white" onClick={exportCsv}>
          Exportar CSV
        </button>
      </div>
      {rows.map((r) => (
        <div key={r.id} className="card">
          <p className="font-medium">{r.fileName}</p>
          <p className="text-xs text-slate-500">
            {r.reportType} · {new Date(r.reportDate).toLocaleDateString()} · {r.project?.name ?? "—"}
          </p>
          {r.sourceUrl && (
            <a className="text-sm text-cyan-700" href={r.sourceUrl} target="_blank" rel="noreferrer">
              Fuente original
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!q) return;
    api(`/api/v1/search?q=${encodeURIComponent(q)}`).then(setData);
  }, [q]);
  if (!data) return <p>Buscando…</p>;
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Resultados para “{q}”</h2>
      {(["testRuns", "testCases", "defects", "evidence", "reports", "releases"] as const).map((k) => (
        <div key={k} className="card">
          <h3 className="font-semibold capitalize">{k}</h3>
          <ul className="mt-2 text-sm">
            {(data[k] ?? []).map((item: any) => (
              <li key={item.id} className="py-1">
                {item.title ?? item.fileName ?? item.version ?? item.tester ?? item.id}
              </li>
            ))}
            {!(data[k] ?? []).length && <li className="text-slate-500">Sin coincidencias</li>}
          </ul>
        </div>
      ))}
    </div>
  );
}
