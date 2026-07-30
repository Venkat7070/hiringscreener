import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, pool, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; roleId: string; candidateId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const comment: unknown = body?.comment;
  if (typeof comment !== "string") {
    return NextResponse.json({ error: "comment must be a string" }, { status: 400 });
  }

  await ensureSchema();

  const { rows: candidateRows } = await sql`
    SELECT id FROM screening_candidates WHERE id = ${params.candidateId} AND session_id = ${params.id}
  `;
  if (!candidateRows[0]) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }
  const { rows: roleRows } = await sql`
    SELECT id FROM screening_roles WHERE id = ${params.roleId} AND session_id = ${params.id}
  `;
  if (!roleRows[0]) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const { rows } = await pool.query(
    `INSERT INTO screening_results (id, candidate_id, role_id, recruiter_comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (candidate_id, role_id) DO UPDATE
     SET recruiter_comment = EXCLUDED.recruiter_comment,
         updated_at = now()
     RETURNING *`,
    [randomUUID(), params.candidateId, params.roleId, comment.trim() || null]
  );

  return NextResponse.json({ result: rows[0] });
}
