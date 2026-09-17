/**
 * Parse Google Sheets to extract P/F/B/S (Passed/Failed/Blocked/Skipped) counts.
 * Supports common headers in Spanish and English.
 */

export interface ParsedEvidence {
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  total?: number;
}

/**
 * Extract sheet ID from Google Sheets URL.
 * Supports formats:
 * - https://docs.google.com/spreadsheets/d/SHEET_ID/edit...
 * - https://docs.google.com/spreadsheets/d/SHEET_ID
 */
export function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Fetch and parse Google Sheets data using the public CSV export URL.
 * This avoids needing OAuth for publicly shared sheets.
 */
export async function parseGoogleSheetsCsv(url: string): Promise<ParsedEvidence> {
  const sheetId = extractSheetId(url);
  if (!sheetId) {
    throw new Error("Invalid Google Sheets URL: could not extract sheet ID");
  }

  // Extract tab ID from URL if present (gid parameter), otherwise use 0 (first sheet)
  const tabIdMatch = url.match(/#gid=(\d+)/);
  const tabId = tabIdMatch ? tabIdMatch[1] : "0";

  // Use public CSV export URL
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${tabId}`;

  try {
    const response = await fetch(csvUrl, {
      headers: {
        "User-Agent": "QA-Control-Center/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sheet: HTTP ${response.status}`);
    }

    const csv = await response.text();
    return parseCsvData(csv);
  } catch (error) {
    const err = error as Error;
    throw new Error(`Failed to parse evidence URL: ${err.message}`);
  }
}

/**
 * Parse CSV data to extract P/F/B/S counts.
 * Searches for headers matching common patterns and extracts corresponding values.
 */
function parseCsvData(csv: string): ParsedEvidence {
  const lines = csv.trim().split("\n");
  if (lines.length === 0) {
    throw new Error("Empty CSV data");
  }

  // Parse the first row as headers
  const headers = parseCSVLine(lines[0]);

  // Try to find columns matching P/F/B/S patterns
  const result: ParsedEvidence = {
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
  };

  // Search in headers and following rows
  for (let i = 0; i < lines.length; i++) {
    const line = parseCSVLine(lines[i]);

    for (let j = 0; j < line.length; j++) {
      const header = headers[j]?.toLowerCase().trim() || "";
      const value = line[j]?.trim() || "";
      const numValue = parseInt(value, 10);

      if (!isNaN(numValue)) {
        if (header.includes("pasado") || header.includes("passed")) {
          result.passed = numValue;
        } else if (header.includes("fallo") || header.includes("failed")) {
          result.failed = numValue;
        } else if (header.includes("bloqueado") || header.includes("blocked")) {
          result.blocked = numValue;
        } else if (header.includes("saltado") || header.includes("skipped")) {
          result.skipped = numValue;
        }
      }
    }
  }

  // Validate that we found at least some values
  const hasValues = result.passed + result.failed + result.blocked + result.skipped > 0;
  if (!hasValues) {
    throw new Error("Could not find P/F/B/S values in the provided sheet");
  }

  // Calculate total
  result.total = result.passed + result.failed + result.blocked + result.skipped;

  return result;
}

/**
 * Parse a CSV line handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
