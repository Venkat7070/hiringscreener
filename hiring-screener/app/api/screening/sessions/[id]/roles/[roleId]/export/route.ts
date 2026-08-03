import { NextResponse } from "next/server";
import { ensureSchema, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { screeningResultsToCsv } from "@/lib/csv";
import type { ScreeningCandidate, ScreeningResult } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { id: string; roleId: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const { rows: roleRows } = await sql`
    SELECT title FROM screening_roles WHERE id = ${params.roleId} AND session_id = ${params.id}
  `;
  if (!roleRows[0]) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const { rows: candidates } = await sql<ScreeningCandidate>`
    SELECT * FROM screening_candidates WHERE session_id = ${params.id} ORDER BY created_at ASC
  `;
  const { rows: results } = await sql<ScreeningResult>`
    SELECT * FROM screening_results WHERE role_id = ${params.roleId}
  `;

  const rows = candidates.map((candidate) => ({
    candidate,
    result: results.find((r) => r.candidate_id === candidate.id) ?? null,
  }));
  rows.sort((a, b) => (b.result?.ai_score ?? -1) - (a.result?.ai_score ?? -1));

  const csv = screeningResultsToCsv(rows);
  const safeTitle = roleRows[0].title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeTitle}-candidates-${Date.now()}.csv"`,
    },
  });
}
