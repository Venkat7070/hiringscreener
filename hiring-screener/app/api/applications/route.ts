import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ensureSchema, sql } from "@/lib/db";
import { isValidRole, LOCATION_CHOICES } from "@/lib/roles";
import { ScoringError, scoreAnswers } from "@/lib/scoring";
import { runBackgroundScoring } from "@/lib/scoreApplication";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import type { ApplicationSubmission } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: ApplicationSubmission;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.role || !isValidRole(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!body.name || !body.name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!Array.isArray(body.answers)) {
    return NextResponse.json({ error: "Answers are required" }, { status: 400 });
  }
  if (!body.freeText || !body.freeText.trim()) {
    return NextResponse.json({ error: "Free-text answer is required" }, { status: 400 });
  }

  if (body.role === "engagement_manager") {
    const valid = LOCATION_CHOICES.some((c) => c.value === body.locationChoice);
    if (!valid) {
      return NextResponse.json({ error: "Location choice is required" }, { status: 400 });
    }
  }

  let scored;
  try {
    scored = scoreAnswers(body.role, body.answers);
  } catch (error) {
    if (error instanceof ScoringError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const id = randomUUID();

  await ensureSchema();
  await sql`
    INSERT INTO applications (
      id, role, name, linkedin, location_choice, answers, free_text,
      cv_url, cv_filename, mechanical_score, stage
    ) VALUES (
      ${id}, ${body.role}, ${body.name.trim()}, ${body.linkedin ?? null},
      ${body.role === "engagement_manager" ? body.locationChoice ?? null : null},
      ${JSON.stringify(scored.answers)}, ${body.freeText.trim()},
      ${body.cvUrl ?? null}, ${body.cvFilename ?? null},
      ${scored.mechanicalScore}, 'Applied'
    )
  `;

  waitUntil(runBackgroundScoring(id, body.role, scored.answers, body.freeText.trim()));

  return NextResponse.json({ id }, { status: 201 });
}

export async function GET() {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureSchema();
  const { rows } = await sql`SELECT * FROM applications ORDER BY submitted_at DESC`;
  return NextResponse.json({ applications: rows });
}
