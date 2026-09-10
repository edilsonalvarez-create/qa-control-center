import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

const CATEGORY_LABELS: Record<string, string> = {
  CLIENT: "Clientes",
  MODULE: "Módulos",
  TEST_TYPE: "Tipo de prueba",
  LEVEL: "Nivel",
  PRIORITY: "Prioridad",
  SEVERITY: "Severidad",
  EXEC_STATUS: "Estado de ejecución",
  DEFECT_STATUS: "Estado de defecto",
  ENVIRONMENT: "Entornos",
  TOOL: "Herramientas",
  AUTOMATABLE: "Automatizable",
  OWNER: "Responsables",
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

type CatalogItem = { id: string; category: string; value: string; sortOrder: number };

function canEditRole(role?: string) {
  return role === "ADMIN" || role === "QA_MANAGER" || role === "QA";
}

export function CatalogPage() {
  const { user } = useAuth();
  const canEdit = canEditRole(user?.role);
  const [rows, setRows] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  async function reload() {
    const data = await api<CatalogItem[]>("/api/v1/catalog");
    setRows(data);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const category of CATEGORY_ORDER) map.set(category, []);
    for (const row of rows) {
      map.set(row.category, [...(map.get(row.category) ?? []), row]);
    }
    return CATEGORY_ORDER.map((category) => [category, map.get(category) ?? []] as const);
  }, [rows]);

  async function addItem(category: string) {
    const value = (drafts[category] ?? "").trim();
    if (!value) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/v1/catalog", { method: "POST", body: JSON.stringify({ category, value }) });
      setDrafts((d) => ({ ...d, [category]: "" }));
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/catalog/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ value: editing.value }),
      });
      setEditing(null);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: CatalogItem) {
    if (!window.confirm(`¿Quitar “${item.value}” de ${CATEGORY_LABELS[item.category] ?? item.category}?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/v1/catalog/${item.id}`, { method: "DELETE" });
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
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await api<{ upserted: number }>("/api/v1/catalog/import", { method: "POST", body: fd });
      await reload();
      if (!result.upserted) setError("El archivo no trajo valores de catálogo.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Catálogo</h2>
          <p className="text-sm text-slate-500">
            Listas maestras (clientes, módulos, estados…). Se pueden ampliar cuando entre un cliente o módulo nuevo.
          </p>
        </div>
        {canEdit && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
            <Upload size={16} />
            Importar Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])}
            />
          </label>
        )}
      </div>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      {busy && <p className="text-sm text-slate-500">Guardando…</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([category, items]) => (
          <div key={category} className="card">
            <h3 className="mb-2 font-semibold">{CATEGORY_LABELS[category] ?? category}</h3>
            <ul className="space-y-1 text-sm">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-900"
                >
                  {editing?.id === item.id ? (
                    <>
                      <input
                        className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-950"
                        value={editing.value}
                        onChange={(e) => setEditing({ id: item.id, value: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      />
                      <button className="text-cyan-700 dark:text-cyan-400" onClick={saveEdit} disabled={busy}>
                        Guardar
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1">{item.value}</span>
                      {canEdit && (
                        <>
                          <button
                            className="text-slate-400 hover:text-cyan-600"
                            aria-label="Editar"
                            onClick={() => setEditing({ id: item.id, value: item.value })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="text-slate-400 hover:text-rose-500"
                            aria-label="Eliminar"
                            onClick={() => removeItem(item)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </>
                  )}
                </li>
              ))}
              {!items.length && <li className="px-2 py-1 text-slate-400">Sin valores aún</li>}
            </ul>
            {canEdit && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addItem(category);
                }}
              >
                <input
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                  placeholder={`Agregar ${CATEGORY_LABELS[category]?.toLowerCase() ?? ""}`}
                  value={drafts[category] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [category]: e.target.value }))}
                />
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-600 px-3 py-1.5 text-white disabled:opacity-50"
                  disabled={busy || !(drafts[category] ?? "").trim()}
                  aria-label="Agregar"
                >
                  <Plus size={16} />
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
