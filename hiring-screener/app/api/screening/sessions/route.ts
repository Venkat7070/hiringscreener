import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, pool, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { MAX_TEXT_CHARS } from "@/lib/textLimits";
import type { RoleStatus, ScreeningSessionSummary } from "@/lib/types";

export const runtime = "nodejs";

function deriveStatus(scoredCount: number, candidateCount: number): RoleStatus {
  if (scoredCount === 0) return "pending";
  if (scoredCount >= candidateCount) return "done";
  return "partial";
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const { rows: sessions } = await pool.query(`
    SELECT s.id, s.name, s.created_at,
           COUNT(DISTINCT c.id)::int AS candidate_count
    FROM screening_sessions s
    LEFT JOIN screening_candidates c ON c.session_id = s.id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `);

  const { rows: roles } = await pool.query(`
    SELECT r.id, r.session_id, r.title, r.jd_text, r.created_at,
           COUNT(res.id) FILTER (WHERE res.ai_score IS NOT NULL)::int AS scored_count
    FROM screening_roles r
    LEFT JOIN screening_results res ON res.role_id = r.id
    GROUP BY r.id
    ORDER BY r.created_at ASC
  `);

  const rolesBySession = new Map<string, typeof roles>();
  for (const role of roles) {
    const list = rolesBySession.get(role.session_id) ?? [];
    list.push(role);
    rolesBySession.set(role.session_id, list);
  }

  const summaries: ScreeningSessionSummary[] = sessions.map((s) => {
    const sessionRoles = rolesBySession.get(s.id) ?? [];
    return {
      id: s.id,
      name: s.name,
      created_at: s.created_at,
      candidateCount: s.candidate_count,
      roles: sessionRoles.map((r) => ({
        id: r.id,
        session_id: r.session_id,
        title: r.title,
        jd_text: r.jd_text,
        created_at: r.created_at,
        candidateCount: s.candidate_count,
        scoredCount: r.scored_count,
        status: deriveStatus(r.scored_count, s.candidate_count),
      })),
    };
  });

  return NextResponse.json({ sessions: summaries });
}

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name?.trim();
  const roles: { title?: string; jdText?: string }[] | undefined = body?.roles;

  if (!name) {
    return NextResponse.json({ error: "Session name is required" }, { status: 400 });
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    return NextResponse.json({ error: "At least one role is required" }, { status: 400 });
  }
  for (const r of roles) {
    if (!r.title?.trim() || !r.jdText?.trim()) {
      return NextResponse.json({ error: "Each role needs a title and a job description" }, { status: 400 });
    }
  }

  await ensureSchema();

  const sessionId = randomUUID();
  await sql`INSERT INTO screening_sessions (id, name) VALUES (${sessionId}, ${name})`;

  for (const r of roles) {
    const roleId = randomUUID();
    await sql`
      INSERT INTO screening_roles (id, session_id, title, jd_text)
      VALUES (${roleId}, ${sessionId}, ${r.title!.trim()}, ${r.jdText!.trim().slice(0, MAX_TEXT_CHARS)})
    `;
  }

  return NextResponse.json({ id: sessionId }, { status: 201 });
}
