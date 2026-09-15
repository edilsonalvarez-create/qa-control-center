import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api, toQuery } from "../lib/api";

type Project = { id: string; name: string };
type CatalogItem = { id: string; category: string; value: string };
type ModuleOption = { id: string; name: string };

export type MatrixCase = {
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
  defectRef: string | null;
  requirementRef: string | null;
  release: string | null;
  sprint: string | null;
  executionDate: string | null;
  defects?: { severity: string; origin: string }[];
  evidence?: { id: string; fileUrl: string | null }[];
  testRun?: {
    id: string;
    version?: string | null;
    environment?: string | null;
    project?: { id: string; name: string };
    module?: { name: string } | null;
  };
};

const CATALOG_KINDS = new Set([
  "TEST_TYPE",
  "LEVEL",
  "PRIORITY",
  "AUTOMATABLE",
  "TOOL",
  "ENVIRONMENT",
  "OWNER",
  "EXEC_STATUS",
  "SEVERITY",
]);

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
  ["environment", "Ambiente", "ENVIRONMENT"],
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

const emptyForm = (): Record<string, string> =>
  Object.fromEntries(FIELDS.map(([k]) => [k, ""])) as Record<string, string>;

function formFromCase(c: MatrixCase): Record<string, string> {
  const f = emptyForm();
  const autoSeverity = c.defects?.find((d) => d.origin === "MANUAL_AUTO")?.severity;
  for (const [k] of FIELDS) {
    if (k === "projectId") f[k] = c.testRun?.project?.id ?? "";
    else if (k === "executionDate") f[k] = c.executionDate ? c.executionDate.slice(0, 10) : "";
    else if (k === "release") f[k] = c.release ?? c.testRun?.version ?? "";
    else if (k === "environment") f[k] = c.environment ?? c.testRun?.environment ?? "";
    else if (k === "severity") f[k] = c.severity ?? autoSeverity ?? "";
    else if (k === "evidenceUrl") f[k] = c.evidenceUrl ?? c.evidence?.[0]?.fileUrl ?? "";
    else f[k] = ((c as Record<string, unknown>)[k] as string | null) ?? "";
  }
  return f;
}

function selectOptions(list: string[], current: string) {
  return current && !list.includes(current) ? [current, ...list] : list;
}

/**
 * Shared create/edit drawer for Matriz QA and Test Cases. Form-created and
 * imported cases write back to the same TestCase row; the table refreshes
 * from the PATCH/POST response so the change is visible immediately.
 */
export function CaseFormDrawer({
  target,
  saveTo,
  onClose,
  onSaved,
}: {
  target: MatrixCase | "new" | null;
  saveTo: "matrix" | "cases";
  onClose: () => void;
  onSaved: (saved?: MatrixCase | null) => Promise<void> | void;
}) {
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const editingId = target && target !== "new" ? target.id : null;
  const lockProject = Boolean(editingId && target && target !== "new" && target.origin === "IMPORT");

  useEffect(() => {
    if (!target) {
      setForm(null);
      return;
    }
    setError("");
    setForm(target === "new" ? emptyForm() : formFromCase(target));
    Promise.all([
      api<CatalogItem[]>("/api/v1/catalog"),
      api<Project[]>("/api/v1/projects?scope=all"),
    ])
      .then(([cat, projs]) => {
        setCatalog(cat);
        setProjects(projs);
      })
      .catch((e) => setError((e as Error).message));
  }, [target]);

  const optionsFor = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of catalog) map.set(item.category, [...(map.get(item.category) ?? []), item.value]);
    return map;
  }, [catalog]);

  const formProjectId = form?.projectId;
  useEffect(() => {
    if (!formProjectId) {
      setModules([]);
      return;
    }
    api<ModuleOption[]>(`/api/v1/modules${toQuery({ projectId: formProjectId, scope: "all" })}`)
      .then(setModules)
      .catch(() => setModules([]));
  }, [formProjectId]);

  if (!target || !form) return null;

  async function submit() {
    if (!form) return;
    if (!form.projectId) return setError("Selecciona un proyecto.");
    if (!form.title.trim()) return setError("El título es obligatorio.");
    setBusy(true);
    setError("");
    try {
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(form)) if (v !== "") payload[k] = v;
      let saved: MatrixCase;
      if (editingId) {
        const path = saveTo === "cases" ? `/api/v1/test-cases/${editingId}` : `/api/v1/matrix/cases/${editingId}`;
        saved = await api<MatrixCase>(path, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        saved = await api<MatrixCase>("/api/v1/matrix/cases", { method: "POST", body: JSON.stringify(payload) });
      }
      await onSaved(saved);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-black/40">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{editingId ? "Editar caso" : "Nuevo caso"}</h3>
          <button aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {error && <p className="mb-3 text-sm text-rose-500">{error}</p>}
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
                    disabled={lockProject}
                    required
                  >
                    <option value="">— Selecciona —</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {lockProject && (
                    <p className="mt-1 text-xs text-slate-400">
                      El proyecto de un caso importado queda en el run original; el resto de campos sí se actualizan.
                    </p>
                  )}
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
            if (key === "moduleName") {
              const options = selectOptions(
                modules.map((m) => m.name),
                value,
              );
              return (
                <label key={k} className="text-sm">
                  <span className="text-slate-500">{label}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                    value={value}
                    disabled={!form.projectId}
                    onChange={(e) => set(e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {!form.projectId && (
                    <p className="mt-1 text-xs text-slate-400">Selecciona primero el Cliente / Proyecto.</p>
                  )}
                </label>
              );
            }
            if (CATALOG_KINDS.has(kind)) {
              const options = selectOptions(optionsFor.get(kind) ?? [], value);
              return (
                <label key={k} className="text-sm">
                  <span className="text-slate-500">{label}</span>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    {options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  {!options.length && (
                    <p className="mt-1 text-xs text-slate-400">Sin valores en Catálogo todavía — agrégalos en Catálogo.</p>
                  )}
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
                {key === "evidenceUrl" && (
                  <p className="mt-1 text-xs text-slate-400">
                    Si aquí está el detalle completo de los casos ejecutados (varias filas/resultados),
                    prefiere subir ese archivo con "Importar Excel". Si solo tienes el enlace, pide que
                    se revise para cargar cada sub-caso por separado.
                  </p>
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
              onClick={onClose}
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
