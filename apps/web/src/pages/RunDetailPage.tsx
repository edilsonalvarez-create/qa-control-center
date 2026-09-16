import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { canEditRole, hasPermission } from "../lib/permissions";
import { formatDateOnly } from "../lib/dates";
import { GoNoGoCell } from "../components/GoNoGo";
import { StatusBadge } from "../components/StatusBadge";

export function RunDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [run, setRun] = useState<any>(null);
  const [error, setError] = useState("");

  const reload = () =>
    api(`/api/v1/test-runs/${id}`)
      .then(setRun)
      .catch((e) => setError((e as Error).message));

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function removeRun() {
    if (
      !window.confirm(
        "¿Eliminar este test run? Se borran también sus casos, defectos y evidencia. Esto no se puede deshacer.",
      )
    )
      return;
    try {
      await api(`/api/v1/test-runs/${id}`, { method: "DELETE" });
      nav("/runs");
    } catch (e) {
      window.alert((e as Error).message);
    }
  }

  if (error) return <p className="text-rose-500">{error}</p>;
  if (!run) return <p>Cargando…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/runs" className="text-sm text-cyan-700 dark:text-cyan-400">
            ← Test Runs
          </Link>
          <h2 className="mt-2 text-2xl font-bold">
            {run.project?.name} · {run.module?.name ?? "Sin módulo"}
          </h2>
          <p className="text-sm text-slate-500">{formatDateOnly(run.executionDate)}</p>
        </div>
        {hasPermission(user, "delete") && (
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950/40"
            onClick={removeRun}
          >
            <Trash2 size={14} /> Eliminar test run
          </button>
        )}
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {[
          ["QA", run.tester ?? "Unknown"],
          ["Ambiente", run.environment],
          ["Versión", run.version ?? "Unknown"],
          ["Commit", run.commit ?? "Unknown"],
        ].map(([k, v]) => (
          <div key={k} className="card">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="font-medium">{v}</p>
          </div>
        ))}
        <div className="card">
          <p className="text-xs text-slate-500">Go / No Go</p>
          <div className="mt-1">
            <GoNoGoCell run={run} canEdit={canEditRole(user?.role)} onChanged={reload} size="md" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {(["totalTests", "passed", "failed", "blocked", "skipped"] as const).map((k) => (
          <div key={k} className="card text-center">
            <p className="text-xs uppercase text-slate-500">{k}</p>
            <p className="text-xl font-semibold">{run[k]}</p>
          </div>
        ))}
      </div>
      {run.observations && (
        <div className="card">
          <h3 className="font-semibold">Observaciones</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{run.observations}</p>
        </div>
      )}
      <div className="card">
        <h3 className="mb-2 font-semibold">Trazabilidad</h3>
        <p className="text-sm text-slate-500">Test Run → Test Case → Defect → Evidence → Retest</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th>Caso</th>
                <th>Resultado</th>
                <th>Defectos</th>
                <th>Evidencias</th>
              </tr>
            </thead>
            <tbody>
              {run.testCases?.map((c: any) => (
                <tr key={c.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="py-2">
                    <p className="font-medium">
                      {c.externalId ? `${c.externalId} · ` : ""}
                      {c.title}
                    </p>
                    <dl className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      {c.acceptanceCriteria && (
                        <div>
                          <dt className="font-semibold">Criterios de Aceptación</dt>
                          <dd className="whitespace-pre-wrap">{c.acceptanceCriteria}</dd>
                        </div>
                      )}
                      {c.preconditions && (
                        <div>
                          <dt className="font-semibold">Precondiciones</dt>
                          <dd className="whitespace-pre-wrap">{c.preconditions}</dd>
                        </div>
                      )}
                      {c.testData && (
                        <div>
                          <dt className="font-semibold">Datos de prueba</dt>
                          <dd className="whitespace-pre-wrap">{c.testData}</dd>
                        </div>
                      )}
                      {c.steps && (
                        <div>
                          <dt className="font-semibold">Pasos</dt>
                          <dd className="whitespace-pre-wrap">{c.steps}</dd>
                        </div>
                      )}
                      {c.expected && (
                        <div>
                          <dt className="font-semibold">Esperado</dt>
                          <dd className="whitespace-pre-wrap">{c.expected}</dd>
                        </div>
                      )}
                      {c.expectedIntegration && (
                        <div>
                          <dt className="font-semibold">Esperado integración</dt>
                          <dd className="whitespace-pre-wrap">{c.expectedIntegration}</dd>
                        </div>
                      )}
                      {c.actual && (
                        <div>
                          <dt className="font-semibold">Obtenido</dt>
                          <dd className="whitespace-pre-wrap">{c.actual}</dd>
                        </div>
                      )}
                      {c.observations && (
                        <div>
                          <dt className="font-semibold">Observaciones</dt>
                          <dd className="whitespace-pre-wrap">{c.observations}</dd>
                        </div>
                      )}
                    </dl>
                  </td>
                  <td>
                    <StatusBadge value={c.status} />
                  </td>
                  <td>
                    {c.defects?.map((d: any) => (
                      <div key={d.id}>
                        <StatusBadge value={d.severity} /> {d.title} ({d.status})
                      </div>
                    ))}
                  </td>
                  <td>
                    {c.evidence?.map((e: any) => (
                      <a key={e.id} className="text-cyan-700 dark:text-cyan-400" href={e.fileUrl ?? "#"} target="_blank" rel="noreferrer">
                        {e.fileName}
                      </a>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold">Evidencias del run</h3>
        <ul className="space-y-2 text-sm">
          {run.evidence?.map((e: any) => (
            <li key={e.id}>
              <StatusBadge value={e.type} />{" "}
              {e.fileUrl ? (
                <a className="text-cyan-700 dark:text-cyan-400" href={e.fileUrl} target="_blank" rel="noreferrer">
                  {e.fileName}
                </a>
              ) : (
                e.fileName
              )}
              <span className="text-slate-500"> — {e.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
