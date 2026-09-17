import { mapStatus, normalizeKey } from "../parsers/normalize.js";

export interface ParsedEvidence {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  /// Rows whose status is pending/not-yet-run. Counted in `total` but in none
  /// of P/F/B/S, which is why those four rarely add up to `total`.
  pending: number;
}

export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

function csvExportUrl(url: string): string {
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    throw Object.assign(new Error("El enlace no es una hoja de Google Sheets válida."), { statusCode: 400 });
  }
  const gid = url.match(/[#&?]gid=(\d+)/);
  const tab = gid ? `&gid=${gid[1]}` : "";
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${tab}`;
}

export async function parseGoogleSheet(url: string): Promise<ParsedEvidence> {
  const response = await fetch(csvExportUrl(url), { redirect: "follow" });
  if (!response.ok) {
    throw Object.assign(
      new Error(
        `Google respondió ${response.status} al descargar la hoja. ` +
          'Comparte la hoja como "Cualquier persona con el enlace puede ver".',
      ),
      { statusCode: 400 },
    );
  }

  const body = await response.text();
  // A sheet that isn't link-shared returns the Google sign-in page as HTML
  // with a 200, so the status code alone doesn't tell us the fetch worked.
  if (/^\s*</.test(body)) {
    throw Object.assign(
      new Error(
        "La hoja no es accesible públicamente: Google devolvió una página de inicio de sesión. " +
          'Compártela como "Cualquier persona con el enlace puede ver".',
      ),
      { statusCode: 400 },
    );
  }

  return countExecutionStatus(body);
}

/**
 * Count one row per test case from the "Estado Ejecución" column. Reuses the
 * importer's mapStatus so a sheet and an imported matrix classify identically.
 */
export function countExecutionStatus(csv: string): ParsedEvidence {
  const rows = parseCsv(csv);
  if (!rows.length) {
    throw Object.assign(new Error("La hoja está vacía."), { statusCode: 400 });
  }

  const header = findHeaderRow(rows);
  if (!header) {
    throw Object.assign(
      new Error('La hoja no tiene una columna "Estado Ejecución" ni "Estado".'),
      { statusCode: 400 },
    );
  }

  const result: ParsedEvidence = { total: 0, passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };

  for (const row of rows.slice(header.rowIndex + 1)) {
    const raw = row[header.columnIndex]?.trim();
    if (!raw) continue;
    result.total++;
    switch (mapStatus(raw)) {
      case "PASS":
        result.passed++;
        break;
      case "FAIL":
        result.failed++;
        break;
      case "BLOCKED":
        result.blocked++;
        break;
      case "SKIPPED":
        result.skipped++;
        break;
      default:
        result.pending++;
    }
  }

  if (!result.total) {
    throw Object.assign(
      new Error('La columna "Estado Ejecución" no tiene ninguna fila con valor.'),
      { statusCode: 400 },
    );
  }
  return result;
}

/**
 * Matrices label this column either "Estado Ejecución" or just "Estado", so the
 * explicit one wins and the generic one is only a fallback. "Estado Defecto" is
 * a different column and must never be mistaken for it.
 */
const STATUS_HEADERS = ["estado ejecucion", "estado de ejecucion", "resultado ejecucion", "estado", "resultado"];

function findHeaderRow(rows: string[][]): { rowIndex: number; columnIndex: number } | undefined {
  let best: { rowIndex: number; columnIndex: number; rank: number } | undefined;
  const limit = Math.min(rows.length, 20);
  for (let r = 0; r < limit; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const rank = STATUS_HEADERS.indexOf(normalizeKey(rows[r][c] ?? ""));
      if (rank === -1) continue;
      if (!best || rank < best.rank) best = { rowIndex: r, columnIndex: c, rank };
    }
  }
  return best && { rowIndex: best.rowIndex, columnIndex: best.columnIndex };
}

/**
 * Full CSV reader: quoted cells in these matrices contain commas AND newlines
 * (steps, expected results), so the file cannot be split on "\n" by line.
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}
