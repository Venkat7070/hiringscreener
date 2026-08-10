import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import type { CandidateSearchResult, Stage } from "@/lib/types";

export const runtime = "nodejs";

const MAX_KEYWORDS = 10;
const MAX_RESULTS = 200;

function extractSnippet(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  let bestIndex = -1;
  for (const kw of keywords) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) bestIndex = idx;
  }
  if (bestIndex === -1) return null;

  const start = Math.max(0, bestIndex - 60);
  const end = Math.min(text.length, bestIndex + 100);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}

export async function GET(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q")?.trim() ?? "";

  const keywords = rawQuery
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, MAX_KEYWORDS);

  if (keywords.length === 0) {
    return NextResponse.json({ results: [] });
  }

  await ensureSchema();

  const patterns = keywords.map((k) => `%${k}%`);

  const { rows: candidateRows } = await pool.query(
    `SELECT c.id, c.name, c.cv_url, c.cv_filename, c.cv_text, c.session_id, s.name AS session_name
     FROM screening_candidates c
     JOIN screening_sessions s ON s.id = c.session_id
     WHERE c.cv_text ILIKE ANY($1) OR c.name ILIKE ANY($1)
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [patterns, MAX_RESULTS]
  );

  const resultsByCandidate = new Map<string, { roleTitle: string; aiScore: number | null; stage: Stage }[]>();
  if (candidateRows.length > 0) {
    const candidateIds = candidateRows.map((c) => c.id);
    const { rows: resultRows } = await pool.query(
      `SELECT res.candidate_id, res.ai_score, res.stage, r.title AS role_title
       FROM screening_results res
       JOIN screening_roles r ON r.id = res.role_id
       WHERE res.candidate_id = ANY($1)`,
      [candidateIds]
    );
    for (const r of resultRows) {
      const list = resultsByCandidate.get(r.candidate_id) ?? [];
      list.push({ roleTitle: r.role_title, aiScore: r.ai_score, stage: r.stage });
      resultsByCandidate.set(r.candidate_id, list);
    }
  }

  const results: CandidateSearchResult[] = candidateRows.map((c) => {
    const matchedKeywords = keywords.filter((kw) => {
      const needle = kw.toLowerCase();
      return c.name.toLowerCase().includes(needle) || (c.cv_text ?? "").toLowerCase().includes(needle);
    });
    return {
      candidateId: c.id,
      candidateName: c.name,
      sessionId: c.session_id,
      sessionName: c.session_name,
      cvUrl: c.cv_url,
      cvFilename: c.cv_filename,
      matchedKeywords,
      snippet: c.cv_text ? extractSnippet(c.cv_text, matchedKeywords) : null,
      results: resultsByCandidate.get(c.id) ?? [],
    };
  });

  return NextResponse.json({ results });
}
