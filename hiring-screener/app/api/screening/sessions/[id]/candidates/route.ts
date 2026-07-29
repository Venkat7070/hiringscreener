import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { extractDocumentText, DocumentTextError } from "@/lib/cvText";

export const runtime = "nodejs";

function nameFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || filename;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cvUrl: string | undefined = body?.cvUrl;
  const cvFilename: string | undefined = body?.cvFilename;

  if (!cvUrl || !cvFilename) {
    return NextResponse.json({ error: "cvUrl and cvFilename are required" }, { status: 400 });
  }

  await ensureSchema();

  const { rows: sessionRows } = await sql`SELECT id FROM screening_sessions WHERE id = ${params.id}`;
  if (!sessionRows[0]) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let cvText: string | null = null;
  let cvTextError: string | null = null;
  try {
    const res = await fetch(cvUrl);
    if (!res.ok) throw new Error(`Failed to download CV: ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    cvText = await extractDocumentText(buffer, cvFilename);
  } catch (error) {
    cvTextError =
      error instanceof DocumentTextError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to extract CV text";
  }

  const id = randomUUID();
  const { rows } = await sql`
    INSERT INTO screening_candidates (id, session_id, name, cv_url, cv_filename, cv_text, cv_text_error)
    VALUES (${id}, ${params.id}, ${nameFromFilename(cvFilename)}, ${cvUrl}, ${cvFilename}, ${cvText}, ${cvTextError})
    RETURNING *
  `;

  return NextResponse.json({ candidate: rows[0] }, { status: 201 });
}
