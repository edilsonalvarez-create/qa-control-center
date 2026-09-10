import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { api, toQuery } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useFilters } from "../lib/filters";
import { StatusBadge } from "../components/StatusBadge";
import { EmptyState } from "../components/EmptyState";

type Project = { id: string; name: string; client?: string | null };
type CatalogItem = { id: string; category: string; value: string };

type MatrixCase = {
  id: string;
  origin: "MANUAL" | "IMPORT";
  externalId: string | null;
  title: string;
  type: string;
  status: string;
  priority: string | null;
  severity: string | null;
  moduleName: string | null;
  product: string | null;
  functionality: string | null;
  level: string | null;
  automatable: string | null;
  tool: string | null;
  preconditions: string | null;
  testData: string | null;
  steps: string | null;
  expected: string | null;
  expectedIntegration: string | null;
  actual: string | null;
  environment: string | null;
  cycle: string | null;
  executor: string | null;
  reviewedBy: string | null;
  observations: string | null;
  evidenceUrl: string | null;
  requirementRef: string | null;
  release: string | null;
  sprint: string | null;
  defectRef: string | null;
  executionDate: string | null;
  testRun?: { id: string; project?: { id: string; name: string }; module?: { name: string } | null };
};

// [field, label, catalog category | "textarea" | "date" | "url" | ""]
const FIELDS: Array<[keyof MatrixCase | "projectId", string, string]> = [
  ["externalId", "ID Caso", ""],
  ["projectId", "Cliente / Proyecto", "project"],
  ["product", "Proyecto / Producto", ""],
  ["release", "Release / Build", ""],
  ["sprint", "Sprint / Iteración", ""],
  ["requirementRef", "Requisito / HU / Ticket", ""],
  ["moduleName", "Módulo / Componente", "MODULE"],
  ["functionality", "Funcionalidad", ""],
  ["title", "Título del Caso", ""],
  ["type", "Tipo de Prueba", "TEST_TYPE"],
  ["level", "Nivel", "LEVEL"],
  ["priority", "Prioridad", "PRIORITY"],
  ["automatable", "Automatizable", "AUTOMATABLE"],
  ["tool", "Herramienta", "TOOL"],
  ["preconditions", "Precondiciones", "textarea"],
  ["testData", "Datos de Prueba", "textarea"],
  ["steps", "Pasos de Ejecución", "textarea"],
  ["expected", "Resultado Esperado", "textarea"],
  ["expectedIntegration", "Resultado Esperado (Sistema Destino / Integración)", "textarea"],
  ["environment", "Entorno Ejecutado", "ENVIRONMENT"],
  ["executionDate", "Fecha Ejecución", "date"],
  ["executor", "Ejecutor", "OWNER"],
  ["cycle", "Ciclo", ""],
  ["actual", "Resultado Obtenido", "textarea"],
  ["status", "Estado", "EXEC_STATUS"],
  ["severity", "Severidad (si falla)", "SEVERITY"],
  ["defectRef", "ID Defecto", ""],
  ["evidenceUrl", "Evidencia (link)", "url"],
  ["observations", "Observaciones", "textarea"],
  ["reviewedBy", "Revisado por (QA Lead)", "OWNER"],
];

function canEditRole(role?: string) {
  return role === "ADMIN" || role === "QA_MANAGER" || role === "QA";
}

const emptyForm = (): Record<string, string> =>
  Object.fromEntries(FIELDS.map(([k]) => [k, ""])) as Record<string, string>;

export function MatrixPage() {
  const { user } = useAuth();
  const canEdit = canEditRole(user?.role);
  const { query } = useFilters();

  const [rows, setRows] = useState<MatrixCase[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dups, setDups] = useState<{ jobId: string; list: { id: string; reason: string }[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const [cases, cat, projs] = await Promise.all([
      api<MatrixCase[]>(`/api/v1/matrix/cases${toQuery(query)}`),
      api<CatalogItem[]>("/api/v1/catalog"),
      api<Project[]>("/api/v1/matrix/projects"),
    ]);
    setRows(cases);
    setCatalog(cat);
    setProjects(projs);
  }

  useEffect(() => {
    reload().catch((e) => setError((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const optionsFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of catalog) map.set(item.category, [...(map.get(item.category) ?? []), item.value]);
    return map;
  }, [catalog]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function openEdit(c: MatrixCase) {
    const f = emptyForm();
    for (const [k] of FIELDS) {
      if (k === "projectId") f[k] = c.testRun?.project?.id ?? "";
      else if (k === "executionDate") f[k] = c.executionDate ? c.executionDate.slice(0, 10) : "";
      else f[k] = ((c as Record<string, unknown>)[k] as string | null) ?? "";
    }
    setEditingId(c.id);
    setForm(f);
  }

  async function submit() {
    if (!form) return;
    if (!form.projectId) return setError("Selecciona un proyecto.");
    if (!form.title.trim()) return setError("El título es obligatorio.");
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(form)) if (v !== "") payload[k] = v;
      if (editingId) {
        await api(`/api/v1/matrix/cases/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        await api("/api/v1/matrix/cases", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(null);
      setEditingId(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
              onClick={openNew}
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
          <button
            className="mt-2 rounded-lg border border-amber-500 px-3 py-1.5"
            onClick={confirmDuplicates}
            disabled={busy}
          >
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
                  <td className="pr-3">
                    {c.executionDate ? new Date(c.executionDate).toLocaleDateString() : "—"}
                  </td>
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
                        <button
                          className="text-slate-400 hover:text-cyan-600"
                          aria-label="Editar"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="text-slate-400 hover:text-rose-500"
                          aria-label="Eliminar"
                          onClick={() => remove(c)}
                        >
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

      {form && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/40">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingId ? "Editar caso" : "Nuevo caso"}</h3>
              <button aria-label="Cerrar" onClick={() => setForm(null)}>
                <X size={18} />
              </button>
            </div>
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {FIELDS.map(([key, label, kind]) => {
                const k = key as string;
                const value = form[k] ?? "";
                const set = (v: string) => setForm((f) => ({ ...(f as Record<string, string>), [k]: v }));
                if (key === "projectId") {
                  return (
                    <label key={k} className="text-sm">
                      <span className="text-slate-500">{label} *</span>
                      <select
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        required
                      >
                        <option value="">— Selecciona —</option>
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                }
                if (kind === "textarea") {
                  return (
                    <label key={k} className="text-sm">
                      <span className="text-slate-500">{label}</span>
                      <textarea
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                        rows={3}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                      />
                    </label>
                  );
                }
                const listId = optionsFor.get(kind) ? `dl-${k}` : undefined;
                return (
                  <label key={k} className="text-sm">
                    <span className="text-slate-500">
                      {label}
                      {key === "title" ? " *" : ""}
                    </span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                      type={kind === "date" ? "date" : kind === "url" ? "url" : "text"}
                      list={listId}
                      value={value}
                      required={key === "title"}
                      onChange={(e) => set(e.target.value)}
                    />
                    {listId && (
                      <datalist id={listId}>
                        {(optionsFor.get(kind) ?? []).map((o) => (
                          <option key={o} value={o} />
                        ))}
                      </datalist>
                    )}
                  </label>
                );
              })}
              <div className="sticky bottom-0 flex gap-2 bg-white pt-3 dark:bg-slate-900">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  disabled={busy}
                >
                  {editingId ? "Guardar cambios" : "Crear caso"}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
                  onClick={() => setForm(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
