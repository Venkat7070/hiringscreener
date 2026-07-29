import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { STAGES, type Stage } from "@/lib/types";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!isAdminAuthenticated()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const stage: Stage | undefined = body?.stage ?? undefined;
  const tags: unknown = body?.tags ?? undefined;

  if (stage !== undefined && !STAGES.includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== "string"))) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }
  if (stage === undefined && tags === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const normalizedTags = Array.isArray(tags)
    ? Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))
    : undefined;

  await ensureSchema();

  const { rows } = await pool.query(
    `UPDATE screening_results
     SET stage = COALESCE($1, stage),
         tags = COALESCE($2::text[], tags),
         updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [stage ?? null, normalizedTags ?? null, params.id]
  );
  if (!rows[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ result: rows[0] });
}
