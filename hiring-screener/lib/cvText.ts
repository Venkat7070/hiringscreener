import mammoth from "mammoth";
import { MAX_TEXT_CHARS } from "./textLimits";

export class DocumentTextError extends Error {}

// pdfjs-dist's legacy build (which pdf-parse uses) expects a browser-like DOM to be
// present — it tries to load @napi-rs/canvas as a Node polyfill for DOMMatrix/ImageData/
// Path2D, but that only works if the exact native binary for the deployed platform is
// installed, which isn't reliable across local (e.g. macOS) vs Vercel's Linux build. Since
// we only ever call getText() (no rendering), a bare-bones stub is enough to stop the
// ReferenceError — nothing here needs to actually behave like a real DOMMatrix/etc.
function ensurePdfDomPolyfills(): void {
  const g = globalThis as Record<string, unknown>;
  if (typeof g.DOMMatrix === "undefined") g.DOMMatrix = class DOMMatrix {};
  if (typeof g.ImageData === "undefined") g.ImageData = class ImageData {};
  if (typeof g.Path2D === "undefined") g.Path2D = class Path2D {};
}

/** Extracts plain text from a CV/JD document so it can be included in a text-only prompt. */
export async function extractDocumentText(buffer: Buffer, filename: string): Promise<string> {
  const ext = (filename || "").split(".").pop()?.toLowerCase();

  if (ext === "pdf") {
    ensurePdfDomPolyfills();
    const { PDFParse } = await import("pdf-parse");
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
