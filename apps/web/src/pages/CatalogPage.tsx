import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { EmptyState } from "../components/EmptyState";

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

type CatalogItem = { id: string; category: string; value: string; sortOrder: number };

export function CatalogPage() {
  const [rows, setRows] = useState<CatalogItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api<CatalogItem[]>("/api/v1/catalog")
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const row of rows) {
      map.set(row.category, [...(map.get(row.category) ?? []), row]);
    }
    return [...map.entries()];
  }, [rows]);

  if (error) return <p className="text-rose-500">{error}</p>;
  if (!rows.length) {
    return (
      <EmptyState
        title="Sin catálogo"
        hint="Importa la matriz estándar (hoja Catalogos) desde Import Center."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Catálogo</h2>
        <p className="text-sm text-slate-500">Listas de la hoja Catalogos. No son KPIs de ejecución.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {grouped.map(([category, items]) => (
          <div key={category} className="card">
            <h3 className="mb-2 font-semibold">{CATEGORY_LABELS[category] ?? category}</h3>
            <ul className="space-y-1 text-sm">
              {items.map((item) => (
                <li key={item.id} className="rounded-lg bg-slate-50 px-2 py-1 dark:bg-slate-900">
                  {item.value}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
