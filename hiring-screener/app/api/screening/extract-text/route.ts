import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { extractDocumentText, DocumentTextError } from "@/lib/cvText";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url: string | undefined = body?.url;
  const filename: string | undefined = body?.filename;

  if (!url || !filename) {
    return NextResponse.json({ error: "url and filename are required" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const text = await extractDocumentText(buffer, filename);
    return NextResponse.json({ text });
  } catch (error) {
    const message =
      error instanceof DocumentTextError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to extract text";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
