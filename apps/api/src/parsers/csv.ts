import { parseCaseRows, toParseResult } from "./table.js";
import type { ParseResult } from "./types.js";

function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cur = "";
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

export function parseCsv(text: string, fileName: string): ParseResult {
  const rows = parseCsvText(text);
  const parsed = parseCaseRows(rows, fileName);
  return toParseResult("csv", fileName, parsed);
}
