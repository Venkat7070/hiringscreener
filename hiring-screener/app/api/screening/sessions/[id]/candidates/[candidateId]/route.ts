import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; candidateId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { rowCount } = await sql`
    DELETE FROM screening_candidates WHERE id = ${params.candidateId} AND session_id = ${params.id}
  `;
  if (!rowCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
