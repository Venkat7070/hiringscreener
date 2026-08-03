import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { GroqScoringError, classifyAndScoreProfile } from "@/lib/groq";
import type { ApplicationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// A CV-text-heavy Groq call per application — keep the batch the caller sends small
// (it drives this in chunks itself, same pattern as the screening run route) so a
// batch never risks the 60s function limit.
const MAX_ATTEMPTS = 2;

// Applications the model judges aren't a genuine candidate for any role get this tag
// instead of a role, so they're visibly reviewed and don't get reprocessed forever.
const NOT_A_CANDIDATE_TAG = "reviewed-no-fit";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: Request) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: unknown = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }

  await ensureSchema();

  const { rows } = await pool.query(`SELECT * FROM applications WHERE id = ANY($1)`, [ids]);
  const applications = rows as ApplicationRecord[];

  let classified = 0;
  let classifiedNone = 0;
  let skipped = 0;
  let failed = 0;
  const results: { id: string; name: string; role: string | null; error?: string }[] = [];

  for (const app of applications) {
    if (app.role) {
      skipped++; // already has a role — nothing to classify
      continue;
    }

    let cvText: string | null = null;
    if (app.cv_url) {
      try {
        const res = await fetch(app.cv_url);
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer());
          const { extractDocumentText } = await import("@/lib/cvText");
          const filename = app.cv_filename ?? new URL(app.cv_url).pathname.split("/").pop() ?? "";
          cvText = await extractDocumentText(buffer, filename);
        }
      } catch {
        // fall back to free_text below
      }
    }

    if (!cvText && !app.free_text) {
      skipped++;
      results.push({ id: app.id, name: app.name, role: null, error: "No CV text or free-text to judge from" });
      continue;
    }

    let result;
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        result = await classifyAndScoreProfile({ cvText, freeText: app.free_text, answers: app.answers });
        break;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) await sleep(2000);
      }
    }

    if (!result) {
      failed++;
      const message =
        lastError instanceof GroqScoringError || lastError instanceof Error
          ? lastError.message
          : "Classification failed";
      results.push({ id: app.id, name: app.name, role: null, error: message });
      continue;
    }

    if (!result.role) {
      classifiedNone++;
      await pool.query(
        `UPDATE applications SET tags = array_append(tags, $1) WHERE id = $2 AND NOT ($1 = ANY(tags))`,
        [NOT_A_CANDIDATE_TAG, app.id]
      );
      results.push({ id: app.id, name: app.name, role: null });
      continue;
    }

    classified++;
    await pool.query(
      `UPDATE applications
       SET role = $1, ai_score = $2, ai_rationale = $3, ai_recommended_stage = $4
       WHERE id = $5`,
      [result.role, result.score, result.rationale, result.recommendedStage, app.id]
    );
    results.push({ id: app.id, name: app.name, role: result.role });
  }

  return NextResponse.json({ classified, classifiedNone, skipped, failed, results });
}
