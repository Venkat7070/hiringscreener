import { NextResponse } from "next/server";
import { pool, sql } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { isValidRole } from "@/lib/roles";
import { STAGES, type Stage } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const stage: Stage | undefined = body?.stage ?? undefined;
  const role: string | undefined = body?.role ?? undefined;
  const tags: unknown = body?.tags ?? undefined;
  const location: string | null | undefined = body?.location !== undefined ? body.location : undefined;

  if (stage !== undefined && !STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (role !== undefined && !isValidRole(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }
  if (location !== undefined && location !== null && typeof location !== "string") {
    return NextResponse.json({ error: "location must be a string or null" }, { status: 400 });
  }
  if (stage === undefined && role === undefined && tags === undefined && location === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const normalizedTags = Array.isArray(tags)
    ? Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))
    : undefined;
  // location is a nullable free-text field, so "provided" (including an explicit null to
  // clear it) must be distinguished from "omitted" — a plain COALESCE can't tell those apart.
  const locationProvided = location !== undefined;
  const normalizedLocation = locationProvided ? location?.trim() || null : null;

  // Retagging to a different role invalidates the existing AI score, since it was
  // computed against the old role's criteria — clear it so it shows as unscored
  // until a re-score runs.
  const { rows } = await pool.query(
    `UPDATE applications
     SET stage = COALESCE($1, stage),
         role = COALESCE($2, role),
         tags = COALESCE($3::text[], tags),
         location = CASE WHEN $5::boolean THEN $4 ELSE location END,
         ai_score = CASE WHEN $2::text IS NOT NULL AND $2::text IS DISTINCT FROM role THEN NULL ELSE ai_score END,
         ai_rationale = CASE WHEN $2::text IS NOT NULL AND $2::text IS DISTINCT FROM role THEN NULL ELSE ai_rationale END,
         ai_recommended_stage = CASE WHEN $2::text IS NOT NULL AND $2::text IS DISTINCT FROM role THEN NULL ELSE ai_recommended_stage END
     WHERE id = $6
     RETURNING *`,
    [stage ?? null, role ?? null, normalizedTags ?? null, normalizedLocation, locationProvided, params.id]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ application: rows[0] });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { rowCount } = await sql`DELETE FROM applications WHERE id = ${params.id}`;
  if (!rowCount) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
