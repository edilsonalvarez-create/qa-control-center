import { useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFilters } from "../lib/filters";
import { canEditRole } from "../lib/permissions";
import { formatDateOnly } from "../lib/dates";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";
import { CaseFormDrawer, type MatrixCase } from "../components/CaseFormDrawer";

export function MatrixPage() {
  const { user } = useAuth();
  const canEdit = canEditRole(user?.role);
  const { query } = useFilters();

  const [rows, setRows] = useState<MatrixCase[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<MatrixCase | "new" | null>(null);
  const [dups, setDups] = useState<{ jobId: string; list: { id: string; reason: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const cases = await api<MatrixCase[]>(`/api/v1/matrix/cases${toQuery(query)}`);
    setRows(cases);
  }

  useEffect(() => {
    reload().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function remove(c: MatrixCase) {
    if (!window.confirm(`¿Eliminar el caso “${c.title}”? Se recalcularán los paneles.`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/matrix/cases/${c.id}`, { method: "DELETE" });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setBusy(true);
    setError("");
    setDups(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api<{ committed: boolean; jobId: string; duplicates?: { id: string; reason: string }[] }>(
        "/api/v1/matrix/import",
        { method: "POST", body: fd },
      );
      if (!res.committed) setDups({ jobId: res.jobId, list: res.duplicates ?? [] });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmDuplicates() {
    if (!dups) return;
    setBusy(true);
    try {
      await api(`/api/v1/import/${dups.jobId}/commit`, {
        method: "POST",
        body: JSON.stringify({ confirmDuplicates: true }),
      });
      setDups(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Matriz QA</h2>
          <p className="max-w-2xl text-sm text-slate-500">
            Registro manual de casos de prueba. Todo lo que se guarda aquí alimenta Dashboard, Coverage,
            Defects y Timeline. Los casos que entran por Import Center / Drive se muestran en solo lectura.
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
              <Upload size={16} />
              Importar Excel
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
              />
            </label>
            <button
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-sm text-white"
              onClick={() => setDrawer("new")}
            >
              <Plus size={16} /> Nuevo caso
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}
      {busy && <p className="text-sm text-slate-500">Procesando…</p>}

      {dups && (
        <div className="rounded-xl border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
          <p className="font-semibold">Duplicados detectados — no se importó automáticamente</p>
          {dups.list.map((d) => (
            <p key={d.id}>{d.reason}</p>
          ))}
          <button className="mt-2 rounded-lg border border-amber-500 px-3 py-1.5" onClick={confirmDuplicates} disabled={busy}>
            Confirmar pese a duplicados
          </button>
        </div>
      )}

      {!rows.length ? (
        <EmptyState
          title="Sin casos en la matriz"
          hint="Crea un caso con “Nuevo caso” o sube el Excel diligenciado con “Importar Excel”."
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-1 pr-3">ID</th>
                <th className="pr-3">Proyecto</th>
                <th className="pr-3">Módulo</th>
                <th className="pr-3">Título</th>
                <th className="pr-3">Tipo</th>
                <th className="pr-3">Prioridad</th>
                <th className="pr-3">Estado</th>
                <th className="pr-3">Ejecutor</th>
                <th className="pr-3">Fecha</th>
                <th className="pr-3">Origen</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-slate-200 align-top dark:border-slate-800">
                  <td className="py-2 pr-3">{c.externalId ?? "—"}</td>
                  <td className="pr-3">{c.testRun?.project?.name ?? "—"}</td>
                  <td className="pr-3">{c.moduleName ?? c.testRun?.module?.name ?? "—"}</td>
                  <td className="max-w-xs pr-3">{c.title}</td>
                  <td className="pr-3">{c.type}</td>
                  <td className="pr-3">{c.priority ?? "—"}</td>
                  <td className="pr-3">
                    <StatusBadge value={c.status} />
                  </td>
                  <td className="pr-3">{c.executor ?? "—"}</td>
                  <td className="pr-3">{formatDateOnly(c.executionDate)}</td>
                  <td className="pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        c.origin === "MANUAL"
                          ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                          : "bg-slate-500/15 text-slate-500"
                      }`}
                    >
                      {c.origin === "MANUAL" ? "Manual" : "Importado"}
                    </span>
                  </td>
                  <td className="pr-1">
                    {canEdit && c.origin === "MANUAL" && (
                      <div className="flex gap-2">
                        <button className="text-slate-400 hover:text-cyan-600" aria-label="Editar" onClick={() => setDrawer(c)}>
                          <Pencil size={14} />
                        </button>
                        <button className="text-slate-400 hover:text-rose-500" aria-label="Eliminar" onClick={() => remove(c)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CaseFormDrawer target={drawer} saveTo="matrix" onClose={() => setDrawer(null)} onSaved={reload} />
    </div>
  );
}
