import { NextResponse } from "next/server";
import { ensureSchema, pool, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import type {
  RoleStatus,
  ScreeningCandidate,
  ScreeningResult,
  ScreeningSessionDetail,
} from "@/lib/types";

export const runtime = "nodejs";

function deriveStatus(scoredCount: number, candidateCount: number): RoleStatus {
  if (scoredCount === 0) return "pending";
  if (scoredCount >= candidateCount) return "done";
  return "partial";
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const { rows: sessionRows } = await sql`SELECT * FROM screening_sessions WHERE id = ${params.id}`;
  const session = sessionRows[0];
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { rows: candidates } = await sql<ScreeningCandidate>`
    SELECT * FROM screening_candidates WHERE session_id = ${params.id} ORDER BY created_at ASC
  `;
  const { rows: results } = await sql<ScreeningResult>`
    SELECT res.* FROM screening_results res
    JOIN screening_candidates c ON c.id = res.candidate_id
    WHERE c.session_id = ${params.id}
  `;
  const { rows: roles } = await pool.query(
    `
    SELECT r.id, r.session_id, r.title, r.jd_text, r.created_at,
           COUNT(res.id) FILTER (WHERE res.ai_score IS NOT NULL)::int AS scored_count
    FROM screening_roles r
    LEFT JOIN screening_results res ON res.role_id = r.id
    WHERE r.session_id = $1
    GROUP BY r.id
    ORDER BY r.created_at ASC
    `,
    [params.id]
  );

  const candidateCount = candidates.length;
  const detail: ScreeningSessionDetail = {
    id: session.id,
    name: session.name,
    created_at: session.created_at,
    candidates,
    results,
    roles: roles.map((r) => ({
      id: r.id,
      session_id: r.session_id,
      title: r.title,
      jd_text: r.jd_text,
      created_at: r.created_at,
      candidateCount,
      scoredCount: r.scored_count,
      status: deriveStatus(r.scored_count, candidateCount),
    })),
  };

  return NextResponse.json({ session: detail });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { rowCount } = await sql`DELETE FROM screening_sessions WHERE id = ${params.id}`;
  if (!rowCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
