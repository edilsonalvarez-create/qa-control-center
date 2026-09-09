import pdfParse from "pdf-parse";
import { parsePlainReport } from "./narrative.js";
import type { ParseResult } from "./types.js";

export async function parsePdf(buffer: Buffer, fileName: string, sourcePath?: string): Promise<ParseResult> {
  try {
    const data = await pdfParse(buffer);
    return parsePlainReport(data.text ?? "", fileName, "pdf", sourcePath);
  } catch {
    const fallback = parsePlainReport("", fileName, "pdf", sourcePath);
    fallback.warnings.push({
      code: "PDF_PARSE_FAILED",
      message: "Could not extract PDF text. Requires review — file stored as evidence reference only.",
    });
    return fallback;
  }
}
