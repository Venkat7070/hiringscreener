import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export const MAX_TEXT_CHARS = 8000;

export class DocumentTextError extends Error {}

/** Extracts plain text from a CV/JD document so it can be included in a text-only prompt. */
export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string> {
  const ext = (filename || "").split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text.slice(0, MAX_TEXT_CHARS);
    } finally {
      await parser.destroy();
    }
  }

  if (ext === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value.slice(0, MAX_TEXT_CHARS);
  }

  throw new DocumentTextError(`Unsupported document file type: ${ext ?? "unknown"}`);
}
