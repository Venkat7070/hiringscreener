import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ensureSchema, pool, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { GroqScoringError, scoreCandidateAgainstJd } from "@/lib/groq";
import type { ScreeningCandidate, ScreeningResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// One Groq call per candidate, heavier than a LinkedIn chat sync round — keep the batch
// small and let the caller repeat the call with an increasing offset until `truncated`
// is false, same pattern as /api/linkedin/sync. 8 was too optimistic once candidates have
// full CV text (up to 8000 chars) rather than short MCQ answers — real-world batches were
// hitting the 60s function timeout, which returns a plain-text platform error page instead
// of JSON and breaks the client's res.json() call.
const BATCH_SIZE = 3;
const MAX_ATTEMPTS = 2;
const RATE_LIMIT_BREAKER = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(
  request: Request,
  { params }: { params: { id: string; roleId: string } }
) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offset = Math.max(0, Number(new URL(request.url).searchParams.get("offset") ?? "0") || 0);
  const body = await request.json().catch(() => null);
  const force: boolean = body?.force === true;
  const candidateIds: string[] | undefined =
    Array.isArray(body?.candidateIds) && body.candidateIds.every((v: unknown) => typeof v === "string")
      ? body.candidateIds
      : undefined;

  await ensureSchema();

  const { rows: roleRows } = await sql`
    SELECT * FROM screening_roles WHERE id = ${params.roleId} AND session_id = ${params.id}
  `;
  const role = roleRows[0];
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const { rows: allCandidates } = await sql<ScreeningCandidate>`
    SELECT * FROM screening_candidates WHERE session_id = ${params.id} ORDER BY created_at ASC
  `;
  const candidates = candidateIds
    ? allCandidates.filter((c) => candidateIds.includes(c.id))
    : allCandidates;
  const { rows: existingResults } = await sql<ScreeningResult>`
    SELECT * FROM screening_results WHERE role_id = ${params.roleId}
  `;
  const resultByCandidateId = new Map(existingResults.map((r) => [r.candidate_id, r]));

  const totalCandidates = candidates.length;
  const truncated = offset + BATCH_SIZE < totalCandidates;
  const nextOffset = truncated ? offset + BATCH_SIZE : null;
  const batch: ScreeningCandidate[] = candidates.slice(offset, offset + BATCH_SIZE);

  let scored = 0;
  let failed = 0;
  let rateLimited = false;
  let consecutiveFailures = 0;

  for (const candidate of batch) {
    const existing = resultByCandidateId.get(candidate.id);
    if (!force && existing && existing.ai_score !== null) {
      continue; // already scored successfully
    }

    if (!candidate.cv_text) {
      await upsertResult(candidate.id, params.roleId, {
        ai_score: null,
        ai_rationale: candidate.cv_text_error ?? "No CV text available to score against.",
        ai_recommended_stage: null,
      });
      failed++;
      continue;
    }

    let result;
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        result = await scoreCandidateAgainstJd(role.jd_text, candidate.cv_text, existing?.recruiter_comment);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await sleep(2000);
      }
    }

    if (!result) {
      consecutiveFailures++;
      failed++;
      const message =
        lastError instanceof GroqScoringError || lastError instanceof Error
          ? lastError.message
          : "Scoring failed";
      await upsertResult(candidate.id, params.roleId, {
        ai_score: null,
        ai_rationale: message,
        ai_recommended_stage: null,
      });

      if (consecutiveFailures >= RATE_LIMIT_BREAKER) {
        rateLimited = true;
        break;
      }
      continue;
    }

    consecutiveFailures = 0;
    scored++;
    await upsertResult(candidate.id, params.roleId, {
      ai_score: result.score,
      ai_rationale: result.rationale,
      ai_recommended_stage: result.recommendedStage,
    });

    if (result.candidateName && !candidate.name_confirmed) {
      await sql`
        UPDATE screening_candidates SET name = ${result.candidateName}, name_confirmed = true
        WHERE id = ${candidate.id}
      `;
    }
  }

  return NextResponse.json({
    scored,
    failed,
    rateLimited,
    truncated: rateLimited ? false : truncated,
    nextOffset: rateLimited ? null : nextOffset,
    totalCandidates,
  });
}

async function upsertResult(
  candidateId: string,
  roleId: string,
  fields: { ai_score: number | null; ai_rationale: string | null; ai_recommended_stage: string | null }
) {
  await pool.query(
    `INSERT INTO screening_results (id, candidate_id, role_id, ai_score, ai_rationale, ai_recommended_stage)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (candidate_id, role_id) DO UPDATE
     SET ai_score = EXCLUDED.ai_score,
         ai_rationale = EXCLUDED.ai_rationale,
         ai_recommended_stage = EXCLUDED.ai_recommended_stage,
         updated_at = now()`,
    [randomUUID(), candidateId, roleId, fields.ai_score, fields.ai_rationale, fields.ai_recommended_stage]
  );
}
