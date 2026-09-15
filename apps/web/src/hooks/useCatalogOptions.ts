import { useMemo } from "react";
import { useApiList } from "./useApiList";

type CatalogItem = { id: string; category: string; value: string; sortOrder: number };

/**
 * Catalog values grouped by category, for any select/filter that must offer
 * exactly the values an admin manages in /catalog — not a hardcoded list that
 * can drift from it. Category order not guaranteed; sort by sortOrder if the
 * caller needs a stable order.
 */
export function useCatalogOptions() {
  const { rows, error, reload } = useApiList<CatalogItem>("/api/v1/catalog");
  const byCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of [...rows].sort((a, b) => a.sortOrder - b.sortOrder)) {
      map.set(item.category, [...(map.get(item.category) ?? []), item.value]);
    }
    return map;
  }, [rows]);
  return { byCategory, error, reload };
}
