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

  const result: ParsedEvidence = {
    passed: 0,
    failed: 0,
    blocked: 0,
    skipped: 0,
  };

  // Column indices for each metric
  let passedIdx = -1;
  let failedIdx = -1;
  let blockedIdx = -1;
  let skippedIdx = -1;

  // Find column indices by header matching
  for (let j = 0; j < headers.length; j++) {
    const header = headers[j]?.toLowerCase().trim() || "";

    if (passedIdx === -1 && (header.includes("pasado") || header.includes("passed") || header === "p")) {
      passedIdx = j;
    } else if (failedIdx === -1 && (header.includes("fallo") || header.includes("failed") || header === "f")) {
      failedIdx = j;
    } else if (blockedIdx === -1 && (header.includes("bloqueado") || header.includes("blocked") || header === "b")) {
      blockedIdx = j;
    } else if (skippedIdx === -1 && (header.includes("saltado") || header.includes("skipped") || header === "s")) {
      skippedIdx = j;
    }
  }

  // If we found columns via headers, extract values from data rows
  if (passedIdx !== -1 || failedIdx !== -1 || blockedIdx !== -1 || skippedIdx !== -1) {
    // Look for numeric values in identified columns (skip header row)
    for (let i = 1; i < lines.length; i++) {
      const line = parseCSVLine(lines[i]);

      if (passedIdx !== -1 && line[passedIdx]) {
        const val = parseInt(line[passedIdx].trim(), 10);
        if (!isNaN(val) && val > 0) result.passed = val;
      }
      if (failedIdx !== -1 && line[failedIdx]) {
        const val = parseInt(line[failedIdx].trim(), 10);
        if (!isNaN(val) && val > 0) result.failed = val;
      }
      if (blockedIdx !== -1 && line[blockedIdx]) {
        const val = parseInt(line[blockedIdx].trim(), 10);
        if (!isNaN(val) && val > 0) result.blocked = val;
      }
      if (skippedIdx !== -1 && line[skippedIdx]) {
        const val = parseInt(line[skippedIdx].trim(), 10);
        if (!isNaN(val) && val > 0) result.skipped = val;
      }
    }
  } else {
    // Fallback: search entire sheet for keywords and extract adjacent numbers
    for (let i = 0; i < lines.length; i++) {
      const line = parseCSVLine(lines[i]);

      for (let j = 0; j < line.length; j++) {
        const cellLower = line[j]?.toLowerCase().trim() || "";
        const numValue = parseInt(line[j] || "", 10);

        if (!isNaN(numValue) && numValue >= 0) {
          if (cellLower.includes("pasado") || cellLower.includes("passed")) {
            result.passed = numValue;
          } else if (cellLower.includes("fallo") || cellLower.includes("failed")) {
            result.failed = numValue;
          } else if (cellLower.includes("bloqueado") || cellLower.includes("blocked")) {
            result.blocked = numValue;
          } else if (cellLower.includes("saltado") || cellLower.includes("skipped")) {
            result.skipped = numValue;
          }
        }
      }
    }
  }

  // Validate that we found at least some values
  const hasValues = result.passed + result.failed + result.blocked + result.skipped > 0;
  if (!hasValues) {
    throw new Error(
      "Could not find P/F/B/S values in the provided sheet. " +
      "Make sure your sheet has columns labeled: Pasados/Fallos/Bloqueados/Saltados " +
      "(or Passed/Failed/Blocked/Skipped in English)"
    );
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
