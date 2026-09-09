import mammoth from "mammoth";
import { parsePlainReport } from "./narrative.js";
import type { ParseResult } from "./types.js";

export async function parseDocx(buffer: Buffer, fileName: string, sourcePath?: string): Promise<ParseResult> {
  const result = await mammoth.extractRawText({ buffer });
  return parsePlainReport(result.value, fileName, "docx", sourcePath);
}
