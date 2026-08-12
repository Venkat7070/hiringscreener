import { NextResponse } from "next/server";
import { ensureSchema, pool } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/requireAdmin";
import { extractLocationFromCv } from "@/lib/locationExtract";
import type { ApplicationRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const app of applications) {
    if (app.location || !app.cv_url) {
      skipped++;
      continue;
    }

    try {
      const res = await fetch(app.cv_url);
      if (!res.ok) throw new Error(`CV fetch failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const { extractDocumentText } = await import("@/lib/cvText");
      const filename = app.cv_filename ?? new URL(app.cv_url).pathname.split("/").pop() ?? "";
      const text = await extractDocumentText(buffer, filename);
      const location = await extractLocationFromCv(text);

      // Store '' rather than leaving NULL when nothing was found, so this row isn't
      // picked up as "unprocessed" and retried forever by future backfill runs — it
      // renders identically to NULL in the UI either way.
      await pool.query(`UPDATE applications SET location = $1 WHERE id = $2`, [location ?? "", app.id]);
      if (location) updated++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ updated, skipped, failed });
}
