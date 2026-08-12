import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { ensureSchema, sql } from "@/lib/db";
import { isValidRole, LOCATION_CHOICES } from "@/lib/roles";
import { ScoringError, scoreAnswers } from "@/lib/scoring";
import { runBackgroundScoring } from "@/lib/scoreApplication";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { extractEmail } from "@/lib/emailExtract";
import { extractLocationFromCv } from "@/lib/locationExtract";
import type { ApplicationSubmission } from "@/lib/types";

/**
 * Best-effort: pulls an email and location from the CV if one was uploaded, else falls
 * back to the free-text answer for email. Imports the CV-parsing module dynamically
 * (rather than at the top of this file) so that GET /api/applications — the main admin
 * listing, hit far more often than this POST handler — never pays the cost of loading
 * it, and can never be taken down if it fails.
 */
async function resolveIdentity(
  cvUrl: string | undefined,
  freeText: string
): Promise<{ email: string | null; location: string | null }> {
  if (cvUrl) {
    try {
      const { extractDocumentText } = await import("@/lib/cvText");
      const res = await fetch(cvUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const filename = new URL(cvUrl).pathname.split("/").pop() ?? "";
        const text = await extractDocumentText(buffer, filename);
        const email = extractEmail(text) ?? extractEmail(freeText);
        const location = await extractLocationFromCv(text);
        return { email, location };
      }
    } catch {
      // fall through to the free-text fallback below
    }
  }
  return { email: extractEmail(freeText), location: null };
}

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
  const { email, location } = await resolveIdentity(body.cvUrl, body.freeText.trim());

  await ensureSchema();
  await sql`
    INSERT INTO applications (
      id, role, name, email, linkedin, location, location_choice, answers, free_text,
      cv_url, cv_filename, mechanical_score, stage
    ) VALUES (
      ${id}, ${body.role}, ${body.name.trim()}, ${email}, ${body.linkedin ?? null}, ${location},
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
