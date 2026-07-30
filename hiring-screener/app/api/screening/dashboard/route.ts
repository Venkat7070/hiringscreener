import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { isValidRole, ROLES } from "@/lib/roles";
import { STAGES, type Stage } from "@/lib/types";

export const runtime = "nodejs";

interface RoleBreakdownRow {
  title: string;
  candidateCount: number;
  scoredCount: number;
  avgScore: number | null;
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();

  const [
    { rows: adhocCandidateCount },
    { rows: applicationCount },
    { rows: adhocScoreStats },
    { rows: applicationScoreStats },
    { rows: adhocStageRows },
    { rows: applicationStageRows },
    { rows: adhocRoleRows },
    { rows: applicationRoleRows },
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int AS count FROM screening_candidates`),
    pool.query(`SELECT COUNT(*)::int AS count FROM applications`),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE ai_score IS NOT NULL)::int AS scored, AVG(ai_score) AS avg
       FROM screening_results`
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE ai_score IS NOT NULL)::int AS scored, AVG(ai_score) AS avg
       FROM applications`
    ),
    pool.query(`SELECT stage, COUNT(*)::int AS count FROM screening_results GROUP BY stage`),
    pool.query(`SELECT stage, COUNT(*)::int AS count FROM applications GROUP BY stage`),
    pool.query(
      `SELECT r.title,
              COUNT(DISTINCT c.id)::int AS candidate_count,
              COUNT(res.id) FILTER (WHERE res.ai_score IS NOT NULL)::int AS scored_count,
              AVG(res.ai_score) FILTER (WHERE res.ai_score IS NOT NULL) AS avg_score
       FROM screening_roles r
       JOIN screening_candidates c ON c.session_id = r.session_id
       LEFT JOIN screening_results res ON res.role_id = r.id AND res.candidate_id = c.id
       GROUP BY r.title
       ORDER BY r.title ASC`
    ),
    pool.query(
      `SELECT role,
              COUNT(*)::int AS candidate_count,
              COUNT(*) FILTER (WHERE ai_score IS NOT NULL)::int AS scored_count,
              AVG(ai_score) FILTER (WHERE ai_score IS NOT NULL) AS avg_score
       FROM applications
       WHERE role IS NOT NULL
       GROUP BY role`
    ),
  ]);

  const totalCandidates = adhocCandidateCount[0].count + applicationCount[0].count;
  const totalScored = adhocScoreStats[0].scored + applicationScoreStats[0].scored;
  const avgScore = weightedAvg(
    [adhocScoreStats[0].scored, applicationScoreStats[0].scored],
    [adhocScoreStats[0].avg, applicationScoreStats[0].avg]
  );

  const stageFunnel: Record<Stage, number> = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
    Stage,
    number
  >;
  for (const row of [...adhocStageRows, ...applicationStageRows]) {
    if (row.stage in stageFunnel) stageFunnel[row.stage as Stage] += row.count;
  }

  const roleBreakdown: RoleBreakdownRow[] = [
    ...adhocRoleRows.map((r) => ({
      title: r.title as string,
      candidateCount: r.candidate_count as number,
      scoredCount: r.scored_count as number,
      avgScore: r.avg_score !== null ? Number(r.avg_score) : null,
    })),
    ...applicationRoleRows
      .filter((r) => isValidRole(r.role))
      .map((r) => ({
        title: ROLES[r.role as keyof typeof ROLES].title,
        candidateCount: r.candidate_count as number,
        scoredCount: r.scored_count as number,
        avgScore: r.avg_score !== null ? Number(r.avg_score) : null,
      })),
  ].sort((a, b) => b.candidateCount - a.candidateCount);

  return NextResponse.json({
    totals: { totalCandidates, totalScored, avgScore },
    stageFunnel: STAGES.map((stage) => ({ stage, count: stageFunnel[stage] })),
    roleBreakdown,
  });
}

function weightedAvg(counts: number[], avgs: (number | string | null)[]): number | null {
  let weightedSum = 0;
  let totalCount = 0;
  for (let i = 0; i < counts.length; i++) {
    const avg = avgs[i];
    if (avg === null || counts[i] === 0) continue;
    weightedSum += Number(avg) * counts[i];
    totalCount += counts[i];
  }
  return totalCount > 0 ? weightedSum / totalCount : null;
}
