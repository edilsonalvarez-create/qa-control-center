import { normalizeText } from "./normalize.js";
import type { CatalogItemParsed } from "./types.js";

const HEADER_CATEGORY: Array<[RegExp, string]> = [
  [/^clientes?$/i, "CLIENT"],
  [/^modulos?$/i, "MODULE"],
  [/^tipo de prueba$/i, "TEST_TYPE"],
  [/^nivel$/i, "LEVEL"],
  [/^prioridad$/i, "PRIORITY"],
  [/^severidad$/i, "SEVERITY"],
  [/^estado ejecucion$/i, "EXEC_STATUS"],
  [/^estado defecto$/i, "DEFECT_STATUS"],
  [/^entornos?$/i, "ENVIRONMENT"],
  [/^herramientas?$/i, "TOOL"],
  [/^automatizable$/i, "AUTOMATABLE"],
  [/^responsables?$/i, "OWNER"],
];

function catalogKey(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryForHeader(header: string): string | undefined {
  const n = catalogKey(header);
  if (!n) return undefined;
  return HEADER_CATEGORY.find(([re]) => re.test(n))?.[1];
}

export function isCatalogSheetName(name: string): boolean {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /catalog/.test(n);
}

export function parseCatalogRows(rows: string[][]): CatalogItemParsed[] {
  if (!rows.length) return [];
  const header = rows[0];
  const cols = header.map((h, index) => ({ index, category: categoryForHeader(h) }));
  const items: CatalogItemParsed[] = [];
  const seen = new Set<string>();
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    for (const col of cols) {
      if (!col.category) continue;
      const value = normalizeText(row[col.index]);
      if (!value) continue;
      const key = `${col.category}|${value.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({ category: col.category, value, sortOrder: items.filter((i) => i.category === col.category).length });
    }
  }
  return items;
}
