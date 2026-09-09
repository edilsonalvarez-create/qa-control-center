import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, toQuery } from "../lib/api";
import { useFilters } from "../lib/filters";
import { EmptyState } from "../components/EmptyState";

type Dash = {
  empty: boolean;
  kpis: Record<string, number | null>;
  byDay: Array<{ date: string; passed: number; failed: number; blocked: number; skipped: number; unknown?: number }>;
  resultMix: Record<string, number>;
  byProject: Array<{ id: string; name: string; totalTests: number; passed: number; failed: number; openDefects: number; status: string }>;
  severityCounts: Record<string, number>;
};

const KPI: Array<[string, string]> = [
  ["totalTests", "Tests"],
  ["executedRuns", "Runs"],
  ["passed", "PASS"],
  ["failed", "FAIL"],
  ["blocked", "BLOCKED"],
  ["skipped", "SKIPPED"],
  ["unknown", "Sin Estado"],
  ["review", "Por revisar"],
  ["defectsFound", "Defectos"],
  ["defectsOpen", "Abiertos"],
  ["defectsCritical", "Críticos"],
  ["defectsRetest", "Retest"],
  ["coveragePct", "Cobertura %"],
  ["successPct", "Éxito %"],
];

export function DashboardPage() {
  const { query } = useFilters();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Dash>(`/api/v1/dashboard${toQuery(query)}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [query]);

  if (error) return <EmptyState title="Error" hint={error} />;
  if (!data) return <p className="text-sm text-slate-500">Cargando…</p>;
  if (data.empty) {
    return (
      <EmptyState
        title="Aún no hay ejecuciones importadas"
        hint="El catálogo de proyectos y módulos sí existe (descubrimiento Drive). Importa una Matriz_QA_*.xlsx real desde Import Center para ver KPIs tomados del campo Estado. No se muestran ceros de éxito inventados."
      />
    );
  }

  const mix = Object.entries(data.resultMix)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));
  const colors = ["#10b981", "#f43f5e", "#f59e0b", "#64748b", "#94a3b8", "#8b5cf6"];
  const sev = Object.entries(data.severityCounts).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-sm text-slate-500">Estado actual de QA — KPIs tomados del campo Estado de cada caso en las matrices importadas.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {KPI.map(([k, label]) => (
          <div key={k} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{data.kpis[k] ?? "—"}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card h-80">
          <p className="mb-2 text-sm font-semibold">Evolución (por día de ejecución)</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={data.byDay}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="passed" stackId="a" fill="#10b981" />
              <Bar dataKey="failed" stackId="a" fill="#f43f5e" />
              <Bar dataKey="blocked" stackId="a" fill="#f59e0b" />
              <Bar dataKey="skipped" stackId="a" fill="#64748b" />
              <Bar dataKey="unknown" stackId="a" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card h-80">
          <p className="mb-2 text-sm font-semibold">Distribución por Estado</p>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={mix} dataKey="value" nameKey="name" outerRadius={90} label>
                {mix.map((_, i) => (
                  <Cell key={i} fill={colors[i % colors.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <p className="mb-3 text-sm font-semibold">Por proyecto (solo identificados en Drive)</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="pb-2">Proyecto</th>
                <th>Tests</th>
                <th>PASS</th>
                <th>FAIL</th>
                <th>Abiertos</th>
              </tr>
            </thead>
            <tbody>
              {data.byProject.map((p) => (
                <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-2">{p.name}</td>
                  <td>{p.totalTests}</td>
                  <td>{p.passed}</td>
                  <td>{p.failed}</td>
                  <td>{p.openDefects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card h-72">
          <p className="mb-2 text-sm font-semibold">Defectos por severidad</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={sev}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
